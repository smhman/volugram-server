import hCaptcha from 'hcaptcha';

const hCaptchaSecret = "ES_fcec54e3a08541d297945ad1ca46e30c";

async function validateCaptcha(captchaToken) {
  try {
    const data = await hCaptcha.verify(hCaptchaSecret, captchaToken);
    if (data.success === true) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}

export default validateCaptcha;