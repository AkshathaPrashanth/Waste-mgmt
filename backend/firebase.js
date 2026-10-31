const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let db = null;

try {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        const dbUrl = "https://smartwastemanagement-59a0a-default-rtdb.firebaseio.com/";
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl
        });
        db = admin.database();
        console.log("Firebase Realtime Database connected successfully.");
    } else {
        console.log("Firebase serviceAccountKey.json not found. Falling back to in-memory mock data.");
    }
} catch (error) {
    console.error("Firebase initialization failed:", error.message);
    console.log("Falling back to in-memory mock data.");
}

module.exports = { db };
