import express, { type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasourceUrl: "file:./dev.db" });
const app = express();

// Use JSON body for payloads [cite: 228]
app.use(express.json());

app.post('/identify', async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "Either email or phoneNumber must be provided." });
    }

    // Build query conditions
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phoneNumber) orConditions.push({ phoneNumber: String(phoneNumber) });

    // 1. Fetch all contacts matching the incoming email or phone
    const matchingContacts = await prisma.contact.findMany({
      where: { OR: orConditions },
    });

    // 2. CASE: No existing contacts. Create a new primary contact.
    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber ? String(phoneNumber) : null,
          linkPrecedence: 'primary',
        },
      });

      return res.status(200).json({
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // 3. CASE: Matches found. Find all related "primary" contacts.
    const primaryIds = new Set<number>();
    for (const contact of matchingContacts) {
      if (contact.linkPrecedence === 'primary') {
        primaryIds.add(contact.id);
      } else if (contact.linkedId) {
        primaryIds.add(contact.linkedId);
      }
    }

    // Fetch the actual primary records and sort them by creation date
    const primaryContacts = await prisma.contact.findMany({
      where: { id: { in: Array.from(primaryIds) } },
      orderBy: { createdAt: 'asc' },
    });

    if (primaryContacts.length === 0) {
      throw new Error("No primary contacts found");
    }

    const oldestPrimary = primaryContacts[0]!;
    const newerPrimaries = primaryContacts.slice(1);

    // 4. Update newer primaries to secondaries (if multiple primaries are linked now)
    if (newerPrimaries.length > 0) {
      for (const primaryToUpdate of newerPrimaries) {
        // Change the newer primary to a secondary
        await prisma.contact.update({
          where: { id: primaryToUpdate.id },
          data: {
            linkPrecedence: 'secondary',
            linkedId: oldestPrimary.id,
          },
        });

        // Redirect all its existing secondaries to the oldest primary
        await prisma.contact.updateMany({
          where: { linkedId: primaryToUpdate.id },
          data: { linkedId: oldestPrimary.id },
        });
      }
    }

    // 5. Check if we need to insert the incoming request as a new secondary
    const existingEmails = new Set(matchingContacts.map((c) => c.email).filter(Boolean));
    const existingPhones = new Set(matchingContacts.map((c) => c.phoneNumber).filter(Boolean));

    const isNewEmail = email && !existingEmails.has(email);
    const isNewPhone = phoneNumber && !existingPhones.has(String(phoneNumber));

    if (isNewEmail || isNewPhone) {
      await prisma.contact.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber ? String(phoneNumber) : null,
          linkedId: oldestPrimary.id,
          linkPrecedence: 'secondary',
        },
      });
    }

    // 6. Construct the final consolidated response
    const allLinkedContacts = await prisma.contact.findMany({
      where: {
        OR: [{ id: oldestPrimary.id }, { linkedId: oldestPrimary.id }],
      },
      orderBy: { createdAt: 'asc' }, // Ensures primary info is first
    });

    const consolidatedEmails = new Set<string>();
    const consolidatedPhones = new Set<string>();
    const secondaryIds: number[] = [];

    for (const contact of allLinkedContacts) {
      if (contact.email) consolidatedEmails.add(contact.email);
      if (contact.phoneNumber) consolidatedPhones.add(contact.phoneNumber);
      if (contact.linkPrecedence === 'secondary') secondaryIds.push(contact.id);
    }

    res.status(200).json({
      contact: {
        primaryContatctId: oldestPrimary.id,
        emails: Array.from(consolidatedEmails),
        phoneNumbers: Array.from(consolidatedPhones),
        secondaryContactIds: secondaryIds,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BiteSpeed Identity Service running on port ${PORT}`);
});