

# TripSync

**The Ultimate Group Travel Companion**

TripSync is a modern, real-time web application designed to solve the chaos of group travel. From splitting bills to agreeing on hotels, it syncs every decision instantly across all devices.

-----

### Key Features

  * **Real-Time Collaboration:** Changes made by one user (like adding an itinerary item) appear instantly on everyone else's screen using Firebase WebSockets.
  * **Seamless Authentication:** Secure sign-in via Google or Email/Password.
  * **Expense Splitting:** Track who paid what and calculate balances automatically. Supports receipt uploads.
  * **Integrated Booking:** Search live hotel prices and availability via the Booking.com API.
  * **Group Chat:** Built-in messaging system for every trip so you don't have to switch apps.
  * **Interactive Timeline:** Drag-and-drop style itinerary planning for your trip duration.

-----

### Backend Architecture (Serverless)

TripSync bypasses the need for a traditional server (like Node.js or Django) by utilizing a **Serverless Architecture** powered by Google Firebase.

**1. Authentication (Firebase Auth)**

  * Handles user sessions securely.
  * Manages Identity Providers (Google, Email) without us needing to store passwords.

**2. Database (Cloud Firestore)**

  * A NoSQL, document-based database that stores all application data.
  * **Structure:**
      * `users`: Stores user profiles and preferences.
      * `trips`: The core collection. Contains trip metadata (dates, destination, join code).
      * `expenses`: Sub-collection linked to a trip. Stores amounts, payers, and split logic.
      * `messages`: Stores chat history for specific trips.
      * `itinerary`: Stores daily activities and voting status.

**3. File Storage (Firebase Storage)**

  * Used for storing receipt images uploaded in the Expense tracker.
  * Returns a secure download URL that is saved to the Firestore document.

-----

### Getting Started

Follow these steps to run the project locally.

**1. Clone the Repository**

```bash
git clone https://github.com/yourusername/tripsync.git
cd tripsync
```

**2. Install Dependencies**

```bash
npm install
```

**3. Environment Configuration**
Create a `.env` file in the root folder and add your keys. You need a Firebase Project and a RapidAPI account (for Booking.com).

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Booking.com API (RapidAPI)
VITE_RAPIDAPI_KEY=your_rapidapi_key
```

**4. Run the App**

```bash
npm run dev
```

Open `http://localhost:5173` to view it in the browser.

-----

### Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React (Vite) | Fast, component-based UI |
| **Styling** | Tailwind CSS | Utility-first styling for responsive design |
| **Icons** | Lucide React | Modern, clean icon set |
| **Backend** | Firebase | Auth, DB, and Storage provider |
| **API** | Booking.com (RapidAPI) | Real-time hotel data |

-----

### Deployment

This project is optimized for **Vercel**.

1.  Push your code to a GitHub repository.
2.  Import the repository into Vercel.
3.  In the "Environment Variables" section of the deployment, add all the keys listed in the Setup section.
4.  Click **Deploy**.

-----

### Troubleshooting

  * **Google Login Fails:** Check your Vercel Environment Variables. Ensure `VITE_FIREBASE_API_KEY` is exact. Also, add your Vercel domain to "Authorized Domains" in the Firebase Console.
  * **Hotel Search Errors:** If you see a 403 error, your RapidAPI key might be missing or unsubscribed. The app will automatically fallback to "Mock Mode" for smooth demos.
  * **White Screen:** Check the browser console (F12). It usually indicates a missing API key.
