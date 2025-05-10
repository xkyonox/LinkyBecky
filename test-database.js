// Create a test user in the database
import { db } from './server/db.js';
import { users } from './shared/schema.js';

async function createTestUser() {
  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(sql`${users.id} = 999`);
    
    if (existingUser.length > 0) {
      console.log('Test user already exists:', existingUser[0]);
      return existingUser[0];
    }
    
    // Create the test user
    const [newUser] = await db.insert(users).values({
      id: 999, 
      email: 'test@example.com',
      username: 'testuser',
      googleId: null,
      name: 'Test User',
      bio: 'Test account for API testing',
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log('Test user created successfully:', newUser);
    return newUser;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

// Run the function
createTestUser()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });