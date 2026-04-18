const express = require('express');
const multer = require('multer');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// S3/Spaces Client Configuration
console.log('Initializing S3 Client with:', {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT,
    bucket: process.env.AWS_S3_BUCKET
});

const s3 = new S3Client({
 //   region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT, // Supports DO Spaces
    forcePathStyle: !!process.env.AWS_S3_ENDPOINT, // Required for some S3-compatible providers
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET,
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
            const fileName = `uploads/${Date.now().toString()}-${file.originalname}`;
            console.log('Generating S3 key:', fileName);
            cb(null, fileName);
        }
    })
});

async function extractDetailsWithLLM(fileBuffer, fileMimeType) {
    // Switching to 2.5-flash as requested by user
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const fileData = fileBuffer.toString("base64");
    
    const prompt = `
        You are a shipping logistics expert. Extract the details from the attached shipping document and return them in a JSON object format.
        
        Organize the JSON into the following sections as top-level keys:
        1. "Cargo & Packaging Details" (Should be an ARRAY of objects if multiple items exist)
        2. "Transport & Shipment Details"
        3. "Commercial & Legal Details"
        4. "Other Shipping Remarks"
        
        Fields to extract for EACH item in the "Cargo & Packaging Details" array:
        - "Package type"
        - "Product No"
        - "Item descriptions"
        - "Quantity"
        - "Net weight"
        - "Gross weight"
        - Transport: Mode, Vessel name, Voyage, ETD, ETA, Container/Seal numbers.
        - Commercial: Incoterms, Shipper name/address, Consignee name/address, Notify party.
        
        Return ONLY the JSON object.
    `;

    const result = await model.generateContent([
        {
            inlineData: {
                data: fileData,
                mimeType: fileMimeType,
            },
        },
        prompt,
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse details" };
}

async function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

app.post('/api/extract', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error("Multer/S3 Upload Error:", err);
            return res.status(500).json({ error: "S3 Upload Failed", details: err.message });
        }
        
        if (!req.file) return res.status(400).send('No file uploaded.');
        
        try {
            console.log('File successfully uploaded to S3:', req.file.location);
            // Fetch file from S3 to process it with Gemini
            const getObjectParams = {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: req.file.key
            };
            const command = new GetObjectCommand(getObjectParams);
            const { Body } = await s3.send(command);
            const buffer = await streamToBuffer(Body);

            const details = await extractDetailsWithLLM(buffer, req.file.mimetype);

            // Cleanup: Delete from S3 after processing
            try {
                const deleteParams = {
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: req.file.key
                };
                await s3.send(new DeleteObjectCommand(deleteParams));
                console.log('File deleted from S3 successfully:', req.file.key);
            } catch (deleteErr) {
                console.error("S3 Cleanup Warning (file might still be in S3):", deleteErr);
            }

            res.json({ details, s3Location: req.file.location });
        } catch (err) {
            console.error("S3/LLM Post-Upload Error:", err);
            res.status(500).json({ error: "Failed to process file from S3." });
        }
    });
});
function renderNestedData(doc, data, level = 0) {
    const indent = level * 20;
    if (typeof data === 'object' && data !== null) {
        if (Array.isArray(data)) {
            data.forEach(item => renderNestedData(doc, item, level));
        } else {
            Object.entries(data).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    doc.fontSize(12).fillColor('#3b82f6').text(`${key}:`, { underline: true });
                    doc.moveDown(0.2);
                    renderNestedData(doc, value, level + 1);
                } else {
                    doc.fontSize(10).fillColor('#1e293b').text(`${key}: `, { continued: true })
                       .fillColor('#475569').text(String(value));
                    doc.moveDown(0.3);
                }
            });
        }
    }
}

// Progressive grid helper for generic sections (Full Width)
function renderGridData(doc, data, startX = 50, tableWidth = 650) {
    if (typeof data !== 'object' || data === null) return;
    const entries = Object.entries(data);
    const cols = 2; 
    const colWidth = tableWidth / cols;
    
    for (let i = 0; i < entries.length; i += cols) {
        const currentY = doc.y;
        for (let j = 0; j < cols; j++) {
            const entry = entries[i + j];
            if (entry) {
                const [key, value] = entry;
                doc.fontSize(10).fillColor('#1e293b').text(`${key}: `, startX + (j * colWidth), currentY, { continued: true })
                   .fillColor('#475569').text(String(value));
            }
        }
        doc.moveDown(0.6);
        if (doc.y > 550) doc.addPage();
    }
}

// Special helper for tabular cargo details in PDF
function renderTableInPDF(doc, items) {
    if (!Array.isArray(items) || items.length === 0) return;

    const allKeys = Array.from(new Set(items.flatMap(item => Object.keys(item))));
    const startX = 50;
    const tableWidth = 650;
    const colWidth = tableWidth / allKeys.length;
    let currentY = doc.y;

    // Table Header
    doc.fontSize(8).fillColor('#1e40af');
    allKeys.forEach((key, i) => {
        doc.text(key, startX + (i * colWidth), currentY, { width: colWidth - 5, align: 'left' });
    });
    doc.moveDown(0.5);
    currentY = doc.y;
    doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke('#cbd5e1');
    doc.moveDown(0.5);

    // Table Body
    doc.fontSize(8).fillColor('#475569');
    items.forEach(item => {
        // Check if row fits
        if (doc.y > 550) {
            doc.addPage();
            currentY = doc.y;
            // Re-draw headers on new page
            doc.fontSize(8).fillColor('#1e40af');
            allKeys.forEach((key, i) => {
                doc.text(key, startX + (i * colWidth), currentY, { width: colWidth - 5, align: 'left' });
            });
            doc.moveDown(0.5);
            currentY = doc.y;
            doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke('#cbd5e1');
            doc.moveDown(0.5);
            doc.fontSize(8).fillColor('#475569');
        }
        
        currentY = doc.y;
        allKeys.forEach((key, i) => {
            doc.text(String(item[key] || '-'), startX + (i * colWidth), currentY, { width: colWidth - 5, align: 'left' });
        });
        doc.moveDown(0.8);
    });

    // Summary Totals
    const weightKeys = allKeys.filter(k => 
        k.toLowerCase().includes('weight') || 
        k.toLowerCase() === 'net' || 
        k.toLowerCase() === 'gross'
    );

    if (weightKeys.length > 0) {
        currentY = doc.y;
        doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke('#3b82f6');
        doc.moveDown(0.5);
        currentY = doc.y;
        doc.fontSize(8).fillColor('#1e40af').text('SUMMARY TOTALS:', startX, currentY);
        
        weightKeys.forEach(key => {
            const index = allKeys.indexOf(key);
            const total = items.reduce((sum, item) => sum + (parseFloat(String(item[key]).replace(/[^0-9.]/g, '')) || 0), 0);
            doc.text(total.toFixed(2), startX + (index * colWidth), currentY, { width: colWidth - 5, align: 'left' });
        });
        doc.moveDown(1.5);
    }
}


app.post('/api/generate-pdf', (req, res) => {
    const { details } = req.body;
    const doc = new PDFDocument({ 
        margin: 50,
        layout: 'landscape',
        size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=shipping_details.pdf');
    
    doc.pipe(res);
    
    // Header
    doc.fontSize(20).fillColor('#1e293b').text('Cargo Extraction Report for BL', { align: 'center' });
    doc.rect(50, 80, 700, 2).fill('#3b82f6');
    doc.moveDown(2);
    
    // Render Sections sequentially
    Object.entries(details).forEach(([section, content]) => {
        // Ensure section title fits
        if (doc.y > 500) doc.addPage();
        
        doc.fontSize(16).fillColor('#1e40af').text(section.toUpperCase(), { underline: true });
        doc.moveDown(0.8);
        
        if (section.toLowerCase().includes('cargo') && Array.isArray(content)) {
            renderTableInPDF(doc, content);
        } else if (section.toLowerCase().includes('transport')) {
            renderGridData(doc, content);
        } else {
            renderNestedData(doc, content, 0);
        }
        
        doc.moveDown(2);
    });
    
    // Footer
    doc.fontSize(8).fillColor('#94a3b8').text(`Generated on ${new Date().toLocaleString()}`, { align: 'right' });
    
    doc.end();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
