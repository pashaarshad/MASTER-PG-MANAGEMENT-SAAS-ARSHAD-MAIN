import { connectToDatabase } from './server/db.js';

async function runSeed() {
  console.log('Connecting to Firebase to trigger seeding...');
  await connectToDatabase();
  console.log('Seeding complete! The database now has Settings and Rules.');
  process.exit(0);
}

runSeed().catch(err => {
  console.error(err);
  process.exit(1);
});
