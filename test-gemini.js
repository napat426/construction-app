const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
  
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent('Hello world');
    console.log('text-embedding-004 dimensions:', result.embedding.values.length);
  } catch (e) {
    console.error('text-embedding-004 error:', e.message);
  }

  try {
    const model2 = genAI.getGenerativeModel({ model: 'text-embedding-001' });
    const result2 = await model2.embedContent('Hello world');
    console.log('text-embedding-001 dimensions:', result2.embedding.values.length);
  } catch (e) {
    console.error('text-embedding-001 error:', e.message);
  }
}

run();
