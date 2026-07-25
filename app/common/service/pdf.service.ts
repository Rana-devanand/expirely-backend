import PDFDocument from 'pdfkit';

export const generateProductReportPDF = (
  user: { username: string; email: string },
  products: any[]
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // 1. Header Area
      doc.fillColor('#10b981')
         .fontSize(24)
         .text('EXPIRELY APP', { align: 'center', underline: false });
         
      doc.fillColor('#64748b')
         .fontSize(10)
         .text('INVENTORY & EXPIRY AUDIT REPORT', { align: 'center' });
         
      doc.moveDown(1.5);

      // Separator Line
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();
         
      doc.moveDown(1);

      // 2. User & Report Metadata Block
      const metaY = doc.y;
      doc.fillColor('#0f172a').fontSize(10);
      
      // Left Column
      doc.font('Helvetica-Bold')
         .text(`Recipient Username: `, 50, metaY, { continued: true })
         .font('Helvetica')
         .text(`${user.username}`);
         
      doc.font('Helvetica-Bold')
         .text(`Recipient Email: `, 50, metaY + 15, { continued: true })
         .font('Helvetica')
         .text(`${user.email}`);

      // Right Column
      doc.font('Helvetica-Bold')
         .text(`Generated Date: `, 320, metaY, { continued: true })
         .font('Helvetica')
         .text(`${new Date().toLocaleDateString()}`);
         
      doc.font('Helvetica-Bold')
         .text(`Format Scope: `, 320, metaY + 15, { continued: true })
         .font('Helvetica')
         .text(`Full Product Inventory PDF`);

      doc.moveDown(2);

      // 3. Metrics Summary Box
      const total = products.length;
      const active = products.filter(p => p.status === 'good' || p.status === 'Active').length;
      const soon = products.filter(p => p.status === 'warning' || p.status === 'Expiring Soon').length;
      const expired = products.filter(p => p.status === 'expired' || p.status === 'Expired').length;

      const summaryY = doc.y;
      doc.rect(50, summaryY, 495, 45)
         .fillColor('#f8fafc')
         .fill()
         .rect(50, summaryY, 495, 45)
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();

      doc.fillColor('#334155').fontSize(9);
      doc.font('Helvetica-Bold').text('TOTAL PRODUCTS', 75, summaryY + 12, { width: 100, align: 'center' });
      doc.font('Helvetica').text('ACTIVE (GOOD)', 195, summaryY + 12, { width: 100, align: 'center' });
      doc.text('EXPIRING SOON', 315, summaryY + 12, { width: 100, align: 'center' });
      doc.text('EXPIRED', 435, summaryY + 12, { width: 100, align: 'center' });

      doc.fillColor('#0f172a').fontSize(12);
      doc.font('Helvetica-Bold').text(`${total}`, 75, summaryY + 25, { width: 100, align: 'center' });
      doc.fillColor('#10b981').text(`${active}`, 195, summaryY + 25, { width: 100, align: 'center' });
      doc.fillColor('#f59e0b').text(`${soon}`, 315, summaryY + 25, { width: 100, align: 'center' });
      doc.fillColor('#ef4444').text(`${expired}`, 435, summaryY + 25, { width: 100, align: 'center' });

      doc.moveDown(3);

      // 4. Products Table
      doc.fillColor('#0f172a')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Detailed Inventory Listing', 50, doc.y);
      doc.moveDown(0.6);

      const tableHeaderY = doc.y;
      doc.fontSize(8.5).fillColor('#64748b');
      doc.font('Helvetica-Bold').text('PRODUCT NAME', 50, tableHeaderY, { width: 160 });
      doc.font('Helvetica').text('CATEGORY', 220, tableHeaderY, { width: 100 });
      doc.text('EXPIRY DATE', 330, tableHeaderY, { width: 80 });
      doc.text('QTY', 420, tableHeaderY, { width: 35, align: 'center' });
      doc.text('STATUS', 465, tableHeaderY, { width: 80, align: 'right' });

      // Table Header Line
      doc.strokeColor('#cbd5e1')
         .lineWidth(1)
         .moveTo(50, tableHeaderY + 12)
         .lineTo(545, tableHeaderY + 12)
         .stroke();

      doc.moveDown(0.8);

      let rowY = tableHeaderY + 20;

      products.forEach((product) => {
        // Page break check (standard letter/A4 heights limit)
        if (rowY > 740) {
          doc.addPage();
          rowY = 50; // reset to margin top
          
          // Re-draw headers on new page
          doc.fontSize(8.5).fillColor('#64748b');
          doc.font('Helvetica-Bold').text('PRODUCT NAME', 50, rowY, { width: 160 });
          doc.font('Helvetica').text('CATEGORY', 220, rowY, { width: 100 });
          doc.text('EXPIRY DATE', 330, rowY, { width: 80 });
          doc.text('QTY', 420, rowY, { width: 35, align: 'center' });
          doc.text('STATUS', 465, rowY, { width: 80, align: 'right' });

          doc.strokeColor('#cbd5e1')
             .lineWidth(1)
             .moveTo(50, rowY + 12)
             .lineTo(545, rowY + 12)
             .stroke();

          rowY += 20;
        }

        const expiryDate = product.expiryDate || product.expiry_date;
        const expiryStr = expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A';
        const qVal = product.qty !== undefined ? product.qty : (product.quantity !== undefined ? product.quantity : 1);
        
        let statusText = 'Active';
        let statusColor = '#10b981'; // Green
        
        if (product.status === 'warning' || product.status === 'Expiring Soon') {
          statusText = 'Expiring Soon';
          statusColor = '#f59e0b'; // Amber
        } else if (product.status === 'expired' || product.status === 'Expired') {
          statusText = 'Expired';
          statusColor = '#ef4444'; // Red
        }

        doc.fillColor('#1e293b').fontSize(8.5);
        doc.font('Helvetica').text(product.name || 'Unnamed Product', 50, rowY, { width: 160, lineBreak: false });
        doc.fillColor('#475569').text(product.category || 'General', 220, rowY, { width: 100, lineBreak: false });
        doc.text(expiryStr, 330, rowY, { width: 80, lineBreak: false });
        doc.text(`${qVal}`, 420, rowY, { width: 35, align: 'center', lineBreak: false });
        
        doc.fillColor(statusColor).font('Helvetica-Bold').text(statusText, 465, rowY, { width: 80, align: 'right', lineBreak: false });

        // Add subtle horizontal grid line
        doc.strokeColor('#f1f5f9')
           .lineWidth(0.5)
           .moveTo(50, rowY + 12)
           .lineTo(545, rowY + 12)
           .stroke();

        rowY += 18;
      });

      // 5. Footer Line
      const footerY = 780;
      doc.strokeColor('#f1f5f9')
         .lineWidth(1)
         .moveTo(50, footerY)
         .lineTo(545, footerY)
         .stroke();
         
      doc.fillColor('#94a3b8')
         .fontSize(8)
         .font('Helvetica')
         .text('Generated automatically by Expirely Admin Console. Confidential - internal audit report.', 50, footerY + 8, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
