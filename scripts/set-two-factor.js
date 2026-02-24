import { MongoClient } from 'mongodb';

// Usage:
// MONGO_URI defaults to mongodb://localhost:27017
// DB_NAME defaults to "algoarena" (change as needed)
// Run: node scripts/set-two-factor.js

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'algoarena';

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const users = db.collection('users');

    console.log('Setting two_factor_enabled = true for all users...');
    const res = await users.updateMany(
      {},
      { $set: { two_factor_enabled: true } },
    );
    console.log(`Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

run();
