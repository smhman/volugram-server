import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  sendmail: true,
  path: '/usr/sbin/sendmail', // binary path (avoids using SMTP)
});

function sendMail(mailOptions) {
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

function acceptedSubmissionMail({ email, language, who, comment = '', attachments = [] }) {
  let baseSubject;
  let text;
  const currentDate = new Date();
  const localeDateString = `${currentDate.getDate()}.${currentDate.getMonth() + 1}.${currentDate.getFullYear()}`;

  switch (language) {
    case 'en':
      baseSubject = `Certificate Issuance (${localeDateString}) by ${who}`;
      text = `Your submission has been accepted. Comment: ${comment}`;
      break;
    case 'de':
      baseSubject = `Zertifikatausstellung (${localeDateString}) durch ${who}`;
      text = `Ihre Einreichung wurde akzeptiert. Kommentar: ${comment}`;
      break;
    case 'no':
      baseSubject = `Sertifikatutstedelse (${localeDateString}) av ${who}`;
      text = `Din innlevering har blitt akseptert. Kommentar: ${comment}`;
      break;
    case 'et':
      baseSubject = `Sertifikaadi väljastamine (${localeDateString}) ${who} poolt`;
      text = `Teie taotlus on vastu võetud. Kommentaar: ${comment}`;
      break;
    default:
      baseSubject = `Certificate Issuance (${localeDateString}) by ${who}`;
      text = `Your submission has been accepted. Comment: ${comment}`;
  }  
  

  const mailOptions = {
    from: 'info@volugram.eu',
    to: email,
    subject: baseSubject,
    text,
    attachments,
  };

  sendMail(mailOptions);
}

function rejectedSubmissionMail({ email, language, who, comment = '' }) {
  let baseSubject;
  let text;
  const currentDate = new Date();
  const localeDateString = `${currentDate.getDate()}.${currentDate.getMonth() + 1}.${currentDate.getFullYear()}`;

  switch (language) {
    case 'en':
      baseSubject = `Rejected Volunteering Submission by ${who} ${localeDateString}`;
      text = `Your submission has been rejected. Comment: ${comment}`;
      break;
    case 'de':
      baseSubject = `Abgelehnte Freiwilligen-Einreichung durch ${who} ${localeDateString}`;
      text = `Ihre Einreichung wurde abgelehnt. Kommentar: ${comment}`;
      break;
    case 'no':
      baseSubject = `Avvist Frivillig Innsending av ${who} ${localeDateString}`;
      text = `Din innlevering har blitt avvist. Kommentar: ${comment}`;
      break;
    case 'et':
      baseSubject = `Tagasi lükatud vabatahtliku esitlus ${who} poolt ${localeDateString}`;
      text = `Teie esitlus on tagasi lükatud. Kommentaar: ${comment}`;
      break;
    default:
      baseSubject = `Rejected Volunteering Submission by ${who} ${localeDateString}`;
      text = `Your submission has been rejected. Comment: ${comment}`;
  }  

  const mailOptions = {
    from: 'info@volugram.eu',
    to: email,
    subject: baseSubject,
    text,
  };

  sendMail(mailOptions);
}

export { sendMail, acceptedSubmissionMail, rejectedSubmissionMail };