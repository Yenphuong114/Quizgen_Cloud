const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function search() {
  const snapshot = await db.collection('Questions').get();
  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.question_text && data.question_text.includes("ngôn ngữ chính quy")) {
      console.log("FOUND IN DATABASE:", data.question_text);
      found = true;
    }
  });
  if (!found) {
    console.log("NOT_FOUND");
  }
}

search();
