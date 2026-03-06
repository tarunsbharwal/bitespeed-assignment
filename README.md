# BiteSpeed Identity Reconciliation Service

A backend web service designed to link multiple orders made with varying contact information to the same consolidated customer profile. 

This project was built for the BiteSpeed Backend Engineering Task.

## 🚀 Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Language:** TypeScript
* **ORM:** Prisma
* **Database:** SQLite (Easily swappable to PostgreSQL/MySQL)

## 🌐 Live URL
*(Replace this line with your Render.com hosted URL once deployed, e.g., `https://your-app-name.onrender.com/identify`)*

## 💻 Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd bitespeed-assignment
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   Create a `.env` file in the root directory and add the following:
   ```
   DATABASE_URL="file:./dev.db"
   ```

4. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server will start on http://localhost:3000.

## 📡 API Documentation

**Endpoint:** `/identify`  
Consolidates contact information and returns a unified customer profile.

**Method:** POST  
**Content-Type:** application/json  

### Request Payload
Accepts either an email, a phoneNumber, or both.
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

### Response Payload (200 OK)
Returns the consolidated profile, with the oldest contact as the primary ID and all newer/linked contacts as secondary IDs.
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

## 🧠 Core Logic Handled
- **New Customers:** Creates a new primary contact if the info doesn't exist.
- **Existing Customers (New Info):** Creates a secondary contact linked to the existing primary if new info is introduced.
- **Primary Collision:** If a request links two previously separate primary contacts, the older one remains primary, and the newer one (along with all its dependents) is converted to secondary.