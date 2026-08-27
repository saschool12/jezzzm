const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Jhonny AI <onboarding@resend.dev>',
      to: 'iorepableo519@gmail.com', // ← CHANGE THIS TO YOUR EMAIL
      subject: 'Test Email',
      html: '<h1>✅ Resend works!</h1>',
    });
    if (error) throw error;
    console.log('✅ Email sent!', data);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

testEmail();
