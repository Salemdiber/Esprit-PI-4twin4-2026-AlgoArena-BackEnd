/**
 * Seed script: populates MongoDB with sample coding challenges
 * Run with: node seed-challenges.js
 * Requires MONGO_URI in .env or defaults to mongodb://localhost:27017/algoarena
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/algoarena';

const ChallengeSchema = new mongoose.Schema({
  title: String,
  description: String,
  examples: [{ input: String, output: String, explanation: String }],
  starterCode: { type: Map, of: String },
  languages: [String],
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
  tags: [String],
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
});

const Challenge = mongoose.model('Challenge', ChallengeSchema);

const challenges = [
  {
    title: 'Two Sum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      { input: '[2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1]' },
      { input: '[3,2,4], target = 6', output: '[1,2]', explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2]' },
      { input: '[3,3], target = 6', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 6, we return [0, 1]' },
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // Your code here
}`,
      python: `def twoSum(nums, target):
    # Your code here
    pass`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Your code here
        return new int[]{};
    }
}`,
    },
    languages: ['javascript', 'python', 'java'],
    difficulty: 'Easy',
    tags: ['Array', 'Hash Table'],
    status: 'published',
  },
  {
    title: 'Reverse a String',
    description: `Write a function that reverses a string. The input string is given as an array of characters \`s\`.

You must do this by modifying the input array in-place with O(1) extra memory.`,
    examples: [
      { input: `["h","e","l","l","o"]`, output: `["o","l","l","e","h"]`, explanation: 'The array is reversed in place' },
      { input: `["H","a","n","n","a","h"]`, output: `["h","a","n","n","a","H"]`, explanation: 'Each character swapped from both ends' },
    ],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {string}
 */
function reverseString(s) {
  // Your code here
}`,
      python: `def reverseString(s):
    # Your code here
    pass`,
      java: `class Solution {
    public void reverseString(char[] s) {
        // Your code here
    }
}`,
    },
    languages: ['javascript', 'python', 'java'],
    difficulty: 'Easy',
    tags: ['String', 'Two Pointers'],
    status: 'published',
  },
  {
    title: 'Fibonacci Number',
    description: `The Fibonacci numbers, commonly denoted \`F(n)\`, form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1.

That is:
- F(0) = 0
- F(1) = 1  
- F(n) = F(n - 1) + F(n - 2), for n > 1

Given \`n\`, calculate \`F(n)\`.`,
    examples: [
      { input: '2', output: '1', explanation: 'F(2) = F(1) + F(0) = 1 + 0 = 1' },
      { input: '3', output: '2', explanation: 'F(3) = F(2) + F(1) = 1 + 1 = 2' },
      { input: '4', output: '3', explanation: 'F(4) = F(3) + F(2) = 2 + 1 = 3' },
    ],
    starterCode: {
      javascript: `/**
 * @param {number} n
 * @return {number}
 */
function fib(n) {
  // Your code here
}`,
      python: `def fib(n):
    # Your code here
    pass`,
      java: `class Solution {
    public int fib(int n) {
        // Your code here
        return 0;
    }
}`,
    },
    languages: ['javascript', 'python', 'java'],
    difficulty: 'Easy',
    tags: ['Math', 'Dynamic Programming', 'Recursion'],
    status: 'published',
  },
  {
    title: 'Valid Palindrome',
    description: `A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return \`true\` if it is a palindrome, or \`false\` otherwise.`,
    examples: [
      { input: '"A man, a plan, a canal: Panama"', output: 'true', explanation: '"amanaplanacanalpanama" is a palindrome.' },
      { input: '"race a car"', output: 'false', explanation: '"raceacar" is not a palindrome.' },
      { input: '" "', output: 'true', explanation: 's is an empty string "" after removing non-alphanumeric characters. Since an empty string reads the same forward and backward, it is a palindrome.' },
    ],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isPalindrome(s) {
  // Your code here
}`,
      python: `def isPalindrome(s):
    # Your code here
    pass`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Your code here
        return false;
    }
}`,
    },
    languages: ['javascript', 'python', 'java'],
    difficulty: 'Easy',
    tags: ['String', 'Two Pointers'],
    status: 'published',
  },
  {
    title: 'Maximum Subarray',
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

A subarray is a contiguous part of an array.

**Constraints:**
- 1 ≤ nums.length ≤ 10^5
- -10^4 ≤ nums[i] ≤ 10^4`,
    examples: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' },
      { input: '[1]', output: '1', explanation: 'The only subarray is [1], with sum 1.' },
      { input: '[5,4,-1,7,8]', output: '23', explanation: 'The subarray [5,4,-1,7,8] has the largest sum 23.' },
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function maxSubArray(nums) {
  // Your code here — hint: try Kadane's algorithm
}`,
      python: `def maxSubArray(nums):
    # Your code here — hint: try Kadane's algorithm
    pass`,
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        // Your code here — hint: try Kadane's algorithm
        return 0;
    }
}`,
    },
    languages: ['javascript', 'python', 'java'],
    difficulty: 'Medium',
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    status: 'published',
  },
  {
    title: 'Climbing Stairs',
    description: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb \`1\` or \`2\` steps. In how many distinct ways can you climb to the top?`,
    examples: [
      { input: '2', output: '2', explanation: 'There are two ways to climb to the top: 1+1 or 2.' },
      { input: '3', output: '3', explanation: 'There are three ways: 1+1+1, 1+2, or 2+1.' },
    ],
    starterCode: {
      javascript: `/**
 * @param {number} n
 * @return {number}
 */
function climbStairs(n) {
  // Your code here
}`,
      python: `def climbStairs(n):
    # Your code here
    pass`,
      java: `class Solution {
    public int climbStairs(int n) {
        // Your code here
        return 0;
    }
}`,
    },
    languages: ['javascript', 'python', 'java'],
    difficulty: 'Easy',
    tags: ['Math', 'Dynamic Programming', 'Memoization'],
    status: 'published',
  },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if challenges already exist
    const existing = await Challenge.countDocuments({ status: 'published' });
    if (existing >= challenges.length) {
      console.log(`ℹ️  Already have ${existing} published challenges. Skipping seed.`);
      await mongoose.disconnect();
      return;
    }

    // Clear old challenges (only the ones matching our titles)
    for (const ch of challenges) {
      await Challenge.deleteOne({ title: ch.title });
    }

    const inserted = await Challenge.insertMany(challenges);
    console.log(`🌱 Seeded ${inserted.length} challenges successfully!`);
    inserted.forEach((c) => console.log(`   - ${c.title} (${c.difficulty})`));
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Done.');
  }
}

seed();
