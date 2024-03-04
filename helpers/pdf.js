import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// import fs from 'fs';

const currentModulePath = fileURLToPath(import.meta.url);
const defaultLogo = join(dirname(currentModulePath), 'logo.png');
const europeLogo = join(dirname(currentModulePath), 'flag_of_europe.png');

function getCertificatePDF(fullName, submissionJson, language, teamLeaderReview) {
    const doc = new PDFDocument({ size: 'A4' });

    let volunteerData = JSON.parse(submissionJson);
    const volunteerReview = volunteerData.volunteerReview;

    if (!volunteerData.certificateLogo) {
        volunteerData.certificateLogo = defaultLogo;
    }

    const languageContent = {
        en: {
            certificateText: 'Certificate',
            certificateTitle: 'Certificate of Volunteer Work',
            volunteerDetails: `To certify that ${fullName}, a ${volunteerData.position}, volunteered for ${volunteerData.hours} hours and ${volunteerData.minutes} minutes. Participated in ${volunteerData.eventTitle} held at ${volunteerData.location}, from ${formatDate(volunteerData.startDate)} to ${formatDate(volunteerData.endDate)}.`,
            userEvaluationTitle: 'Volunteer Self-Evaluation',
            teamLeaderEvaluationTitle: 'Team Leader Evaluation',
            category: 'Category',
            rating: 'Rating',
            overallRating: 'Overall rating',
        },
        de: {
            certificateText: 'Zertifikat',
            certificateTitle: 'Zertifikat der ehrenamtlichen Arbeit',
            volunteerDetails: `Um zu bescheinigen, dass ${fullName}, ein/e ${volunteerData.position}, für ${volunteerData.hours} Stunden und ${volunteerData.minutes} Minuten ehrenamtlich gearbeitet hat. Teilnahme an ${volunteerData.eventTitle} in ${volunteerData.location}, vom ${formatDate(volunteerData.startDate)} bis ${formatDate(volunteerData.endDate)}.`,
            userEvaluationTitle: 'Ehrenamtliche Selbstbewertung',
            teamLeaderEvaluationTitle: 'Bewertung durch den Teamleiter',
            category: 'Kategorie',
            rating: 'Bewertung',
            overallRating: 'Gesamtbewertung',
        },
        et: {
            certificateText: 'Tunnistus',
            certificateTitle: 'Vabatahtliku töö tunnistus',
            volunteerDetails: `Sertifitseeritakse, et ${fullName}, ${volunteerData.position}, osales vabatahtlikuna ${volunteerData.hours} tundi ja ${volunteerData.minutes} minutit. Osalesid ${volunteerData.eventTitle} asukohas ${volunteerData.location}, ajavahemikul ${formatDate(volunteerData.startDate)} kuni ${formatDate(volunteerData.endDate)}.`,
            userEvaluationTitle: 'Vabatahtliku Enesehinnang',
            teamLeaderEvaluationTitle: 'Juhi hinnang',
            category: 'Kategooria',
            rating: 'Hinne',
            overallRating: 'Üldine hinnang',
        },
        no: {
            certificateText: 'Sertifikat',
            certificateTitle: 'Frivillighetsbevis',
            volunteerDetails: `For å bekrefte at ${fullName}, en ${volunteerData.position}, deltok frivillig i ${volunteerData.hours} timer og ${volunteerData.minutes} minutter. Deltok i ${volunteerData.eventTitle} arrangert på ${volunteerData.location}, fra ${formatDate(volunteerData.startDate)} til ${formatDate(volunteerData.endDate)}.`,
            userEvaluationTitle: 'Frivillig Selvvurdering',
            teamLeaderEvaluationTitle: 'Leder Vurdering',
            category: 'Kategori',
            rating: 'Vurdering',
            overallRating: 'Samlet vurdering',
        },
    };   

    // First page - Details and summary
    doc.moveDown(12);
    // doc.image(defaultLogo, { fit: [450, 450], align: 'center' });

    doc.fontSize(72).font('Helvetica-Bold').text(languageContent[language].certificateText, { align: 'center' });

    doc.fontSize(18).font('Helvetica-Bold').text(languageContent[language].certificateTitle, { align: 'center' });
    doc.moveDown(0.5);

    doc.font('Helvetica');

    doc.fontSize(18).text(`${fullName}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14);
    doc.text(languageContent[language].volunteerDetails, { align: 'center', lineHeight: 1.5 });

    const logoWidth = 100;
    doc.image(volunteerData.certificateLogo, doc.page.width - logoWidth - 50, 50, { width: logoWidth });

    doc.image(europeLogo, 50, 50, { fit: [100, 100] });

    doc.text(`${new Date().toLocaleDateString('en-GB')}`, 50, doc.page.height - 90, { align: 'left' });

    doc.strokeColor('#000').lineWidth(1).moveTo(50, doc.page.height - 45).lineTo(550, doc.page.height - 45).stroke();

    // Second page - User self-assessment evaluation & Team leader assessment evaluation
    doc.addPage();

    doc.fontSize(32).font('Helvetica-Bold').text(languageContent[language].userEvaluationTitle, { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(20);

    const tableWidth = 400;
    const tableX = (doc.page.width - tableWidth) / 2;
    let tableY = doc.y;
    const cellPadding = 125;

    doc.font('Helvetica').text(languageContent[language].category, tableX, tableY);
    doc.text(languageContent[language].rating, tableX + 200 + cellPadding, tableY);
    doc.strokeColor('#000').lineWidth(1).moveTo(tableX, tableY + 20).lineTo(tableX + tableWidth, tableY + 20).stroke();

    volunteerReview.forEach((category, index) => {
        const rowY = tableY + (index + 1) * 25;

        doc.fillColor('#E0F7E0').rect(tableX, rowY, tableWidth, 20).fill();
        doc.fillColor('#000000');

        doc.text(category.name, tableX, rowY);
        doc.text(category.rating, tableX + 200 + cellPadding, rowY).fillColor('#000000');
        doc.strokeColor('#000').lineWidth(2).moveTo(tableX, rowY + 20).lineTo(tableX + tableWidth, rowY + 20).stroke();
        doc.moveDown(0.5);
    });

    const overallScore = calculateOverallScore(volunteerReview);
    const overallDescription = calculateOverallDescription(overallScore, language);

    doc.text(`${languageContent[language].overallRating}: ${overallDescription}`, tableX, doc.y).fillColor('#000');

    doc.strokeColor('#000').lineWidth(1).moveTo(50, doc.page.height - 45).lineTo(550, doc.page.height - 45).stroke();

    // Increase the tableY to add space between the two tables
    tableY += 325;

    // Team leader assessment evaluation
    doc.moveDown(3.5);
    doc.fontSize(32).font('Helvetica-Bold').text(languageContent[language].teamLeaderEvaluationTitle, { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(20);

    doc.font('Helvetica').text(languageContent[language].category, tableX, tableY);
    doc.text(languageContent[language].rating, tableX + 200 + cellPadding, tableY);
    doc.strokeColor('#000').lineWidth(1).moveTo(tableX, tableY + 20).lineTo(tableX + tableWidth, tableY + 20).stroke();

    teamLeaderReview.forEach((category, index) => {
        const rowY = tableY + (index + 1) * 25;

        doc.fillColor('#f7ebe0').rect(tableX, rowY, tableWidth, 20).fill();
        doc.fillColor('#000000');

        doc.text(category.name, tableX, rowY);
        doc.text(category.rating, tableX + 200 + cellPadding, rowY).fillColor('#000000');
        doc.strokeColor('#000').lineWidth(2).moveTo(tableX, rowY + 20).lineTo(tableX + tableWidth, rowY + 20).stroke();
        doc.moveDown(0.5);
    });

    const teamLeaderOverallScore = calculateOverallScore(teamLeaderReview);
    const teamLeaderOverallDescription = calculateOverallDescription(teamLeaderOverallScore, language);

    doc.text(`${languageContent[language].overallRating}: ${teamLeaderOverallDescription}`, tableX, doc.y).fillColor('#000');

    doc.strokeColor('#000').lineWidth(1).moveTo(50, doc.page.height - 45).lineTo(550, doc.page.height - 45).stroke();

    return new Promise((resolve, reject) => {
        const chunks = [];
        let result;

        doc.on('data', (chunk) => {
            chunks.push(chunk);
        });

        doc.on('end', () => {
            result = Buffer.concat(chunks);
            resolve(result);
        });

        doc.on('error', (err) => {
            reject(err);
        });

        doc.end();
    });
}

function calculateOverallScore(categories) {
    return categories.reduce((sum, category) => sum + category.rating, 0) / categories.length;
}

function formatDate(date) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
}

function calculateOverallDescription(score, language) {
    const descriptions = {
        en: {
            outstanding: 'Outstanding',
            exceedsExpectations: 'Exceeds expectations',
            meetsExpectations: 'Meets expectations',
            needsImprovement: 'Needs improvement',
            doesNotMeetExpectations: 'Does not meet expectations',
        },
        de: {
            outstanding: 'Hervorragend',
            exceedsExpectations: 'Übertrifft Erwartungen',
            meetsExpectations: 'Entspricht den Erwartungen',
            needsImprovement: 'Bedarf Verbesserung',
            doesNotMeetExpectations: 'Entspricht nicht den Erwartungen',
        },
        et: {
            outstanding: 'Väga hea',
            exceedsExpectations: 'Ületab ootusi',
            meetsExpectations: 'Vastab ootustele',
            needsImprovement: 'Vajab parendamist',
            doesNotMeetExpectations: 'Ei vasta ootustele',
        },
        no: {
            outstanding: 'Utmerket',
            exceedsExpectations: 'Overgår forventningene',
            meetsExpectations: 'Møter forventningene',
            needsImprovement: 'Trenger forbedring',
            doesNotMeetExpectations: 'Møter ikke forventningene',
        },
    };

    if (score > 4.5) {
        return descriptions[language].outstanding;
    } else if (score > 3.5) {
        return descriptions[language].exceedsExpectations;
    } else if (score > 2.5) {
        return descriptions[language].meetsExpectations;
    } else if (score > 1.5) {
        return descriptions[language].needsImprovement;
    } else {
        return descriptions[language].doesNotMeetExpectations;
    }
}

// This is what should end up in database
const volunteerData = {
    "email":"axsylvester.hommuk@gmail.com",
    "minutes":25,
    "hours":6,
    "language":"en",
    "mainTasks":"Cleaning",
    "position":"Cleaner",
    "dateOfBirth":"2014-01-10",
    "eventTitle":"asd",
    "eventDescription":"asdasdasdasd",
    "contactPerson":"Admin",
    "location":"Tartu",
    "startDate":"2024-01-04",
    "endDate":"2024-01-05",
   "volunteerReview":[
      {
         "name":"Teamwork Abilities",
         "rating":3,
         "comments":""
      },
      {
         "name":"Communication Skills",
         "rating":5,
         "comments":""
      },
      {
         "name":"Taking Initiative",
         "rating":4.3,
         "comments":""
      },
      {
         "name":"Planning and Organisational Skills",
         "rating":3.7,
         "comments":""
      },
      {
         "name":"Self-development",
         "rating":4.5,
         "comments":"asd"
      }
   ],
    // "certificateLogo": "base64" (optional)
 };

 // This is from the approve endpoint in the body
 const teamLeaderData = {
    "teamLeaderReview": [
        {
            "name": "Teamwork",
            "rating": 4
        },
        {
            "name": "Planning and Organizational Skills",
            "rating": 5
        },
        {
            "name": "Problem Solving",
            "rating": 4
        }
    ]
 }

// getCertificatePDF("John Doe sdasdaa", volunteerData, "et", teamLeaderData.teamLeaderReview)
//     .then((pdfBuffer) => {
//         // The 'pdfBuffer' contains the PDF data in longblob format
//         // You can now save this to your database as a longblob data
//         // Perform the database insertion logic here
//         fs.writeFileSync('certificate.pdf', pdfBuffer);
//     })
//     .catch((err) => {
//         console.error('Error generating PDF:', err);
//     });

export { getCertificatePDF };