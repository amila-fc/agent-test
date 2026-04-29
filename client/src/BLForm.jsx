import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Printer, Info } from 'lucide-react';
import { jsPDF } from 'jspdf';

const BLForm = ({ data, onBack }) => {
  const [formData, setFormData] = useState({
    shipper: '',
    consignee: '',
    notifyParty: '',
    blNumber: '',
    exportReference: '',
    vesselVoyage: '',
    portLoadingDischarge: '',
    placeOfReceipt: '',
    placeOfDelivery: '',
    freightTerms: '',
    numOriginalBL: '3',
    containerSealNo: '',
    marksNumbers: '',
    descriptionGoods: '',
    grossWeight: '',
    netWeight: '',
    measurementCBM: '',
    placeDateIssue: new Date().toLocaleDateString(),
    authorizedSignature: ''
  });

  // Load from localStorage on mount or data change
  useEffect(() => {
    const savedDraft = localStorage.getItem('bl_draft');
    if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
    } else if (data) {
      const comms = data['Commercial & Legal Details'] || {};
      const transport = data['Transport & Shipment Details'] || {};
      const cargo = data['Cargo & Packaging Details'] || [];
      const blData = data['BL Additional Data points'] || {};
      const remarks = data['Other Shipping Remarks'] || {};

      // Helper to extract country (last word/part of address)
      const extractCountry = (address) => {
        if (!address) return '';
        const parts = address.split(',').map(p => p.trim());
        return parts[parts.length - 1] || '';
      };

      // Map extracted data to form fields
      const shipperInfo = `${comms['Shipper name'] || ''}\n${comms['Shipper address'] || ''}`.trim();
      const consigneeInfo = `${comms['Consignee name'] || ''}\n${comms['Consignee address'] || ''}`.trim();
      const notifyInfo = `${comms['Notify party'] || ''}\n${comms['Notify party address'] || ''}`.trim();
      
      const weights = `${blData['Total Gross Weight'] || ''}\n${blData['Total Net Weight'] || ''}`.trim();
      const containers = transport['Container/Seal numbers'] || '';

      const initialData = {
        shipper: shipperInfo,
        consignee: consigneeInfo,
        notifyParty: notifyInfo,
        blNumber: transport['Bill of Lading Number'] || '',
        exportReference: remarks['Shipping instructions'] || '',
        vesselVoyage: `${transport['Vessel Name'] || ''} / ${transport['Voyage'] || ''}`.trim(),
        descriptionGoods: blData['cargo description'] || '',
        grossWeight: blData['Total Gross Weight'] || '',
        netWeight: blData['Total Net Weight'] || '',
        measurementCBM: cargo.length > 0 ? (cargo[0]['Measurement'] || cargo[0]['CBM'] || '') : '',
        containerSealNo: containers,
        freightTerms: comms['Incoterms'] || '',
        portLoadingDischarge: extractCountry(comms['Shipper address']),
        placeOfReceipt: extractCountry(comms['Shipper address']),
        placeOfDelivery: extractCountry(comms['Consignee address']),
        numOriginalBL: '3',
        marksNumbers: '',
        placeDateIssue: new Date().toLocaleDateString(),
        authorizedSignature: ''
      };
      
      setFormData(initialData);
      localStorage.setItem('bl_draft', JSON.stringify(initialData));
    }
  }, [data]);

  // Persist changes to localStorage
  useEffect(() => {
    if (formData.shipper || formData.blNumber) { // Avoid saving empty initial state
        localStorage.setItem('bl_draft', JSON.stringify(formData));
    }
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = () => {
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GLOBAL CONSOLIDATORS PTE LTD", margin, y);
    
    doc.setFontSize(10);
    doc.text("BILL OF LADING", margin, y + 8);
    doc.text(`B/L NO: ${formData.blNumber}`, 195 - margin, y + 8, { align: 'right' });
    
    y += 15;
    
    // Boxes Grid
    doc.setLineWidth(0.3);
    
    // Shipper & Consignee
    doc.rect(margin, y, 90, 40); // Shipper box
    doc.setFontSize(8);
    doc.text("SHIPPER / EXPORTER", margin + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(formData.shipper, margin + 2, y + 12, { maxWidth: 85 });
    
    doc.rect(margin + 90, y, 90, 40); // Consignee box
    doc.setFont("helvetica", "bold");
    doc.text("CONSIGNEE", margin + 92, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(formData.consignee, margin + 92, y + 12, { maxWidth: 85 });
    
    y += 40;
    
    // Notify Party
    doc.rect(margin, y, 180, 40);
    doc.setFont("helvetica", "bold");
    doc.text("NOTIFY PARTY", margin + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(formData.notifyParty, margin + 2, y + 12, { maxWidth: 175 });
    
    y += 40;
    
    // Logistics Table
    const tableRows = [
      ["VESSEL / VOY", formData.vesselVoyage],
      ["PORT OF LOADING", formData.portLoadingDischarge],
      ["PORT OF DISCHARGE", ""], // Often needs manual entry or further logic
      ["PLACE OF RECEIPT", formData.placeOfReceipt],
      ["PLACE OF DELIVERY", formData.placeOfDelivery]
    ];
    
    tableRows.forEach(row => {
      doc.rect(margin, y, 40, 8);
      doc.setFont("helvetica", "bold");
      doc.text(row[0], margin + 2, y + 5);
      
      doc.rect(margin + 40, y, 140, 8);
      doc.setFont("helvetica", "normal");
      doc.text(String(row[1]), margin + 42, y + 5);
      y += 8;
    });
    
    y += 5;
    
    // Cargo Details Header
    doc.rect(margin, y, 90, 10);
    doc.setFont("helvetica", "bold");
    doc.text("CONTAINER / SEAL NO", margin + 2, y + 6);
    
    doc.rect(margin + 90, y, 90, 10);
    doc.text("MARKS & NOS", margin + 92, y + 6);
    
    y += 10;
    
    // Cargo Details Body
    doc.rect(margin, y, 180, 50);
    doc.setFontSize(8);
    doc.text("DESCRIPTION OF GOODS", margin + 2, y + 5);
    doc.text("G/W & MEASUREMENT", 195 - margin - 2, y + 5, { align: 'right' });
    
    doc.setFont("helvetica", "normal");
    doc.text(formData.descriptionGoods, margin + 2, y + 15, { maxWidth: 100 });
    doc.text(formData.containerSealNo, margin + 2, y + 40, { maxWidth: 100 });
    
    const weightInfo = `G.W: ${formData.grossWeight} KG\nN.W: ${formData.netWeight} KG\nMEAS: ${formData.measurementCBM} CBM`;
    doc.text(weightInfo, 195 - margin - 2, y + 15, { align: 'right' });
    
    y += 55;
    
    // Footer
    doc.rect(margin, y, 180, 25);
    doc.setFont("helvetica", "bold");
    doc.text("FREIGHT TERMS:", margin + 2, y + 8);
    doc.setFont("helvetica", "normal");
    doc.text(formData.freightTerms, margin + 40, y + 8);
    
    doc.setFont("helvetica", "bold");
    doc.text("PLACE & DATE OF ISSUE:", margin + 2, y + 18);
    doc.setFont("helvetica", "normal");
    doc.text(formData.placeDateIssue, margin + 50, y + 18);
    
    doc.setFont("helvetica", "bold");
    doc.text("AUTHORISED SIGNATORY", 195 - margin - 2, y + 18, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.text(formData.authorizedSignature, 195 - margin - 2, y + 8, { align: 'right' });

    doc.save(`BL_${formData.blNumber || 'Draft'}.pdf`);
  };

  return (
    <div className="bl-form-container fading-in">
      <div className="form-header-nav">
        <button onClick={onBack} className="secondary-btn mini">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
        <div className="action-buttons">
          <button onClick={() => alert('Draft saved')} className="secondary-btn mini">
            <Save size={18} /> Save Draft
          </button>
          <button onClick={handlePrint} className="primary-btn mini">
            <Printer size={18} /> Print B/L
          </button>
        </div>
      </div>

      <div className="web-form glass">
        <div className="form-title">
          <h2>Bill of Lading Editor</h2>
          <p>Review and edit the extracted information before finalization</p>
        </div>

        <form className="modern-form">
          {/* Section: Involved Parties */}
          <div className="form-section">
            <h3 className="section-title"><Info size={18} /> Involved Parties</h3>
            <div className="form-grid">
              <div className="input-group full-width">
                <label>Shipper / Exporter</label>
                <textarea name="shipper" value={formData.shipper} onChange={handleChange} rows="4" placeholder="Enter shipper name and address..." />
              </div>
              <div className="input-group full-width">
                <label>Consignee</label>
                <textarea name="consignee" value={formData.consignee} onChange={handleChange} rows="4" placeholder="Enter consignee name and address..." />
              </div>
              <div className="input-group full-width">
                <label>Notify Party</label>
                <textarea name="notifyParty" value={formData.notifyParty} onChange={handleChange} rows="4" placeholder="Enter notify party name and address..." />
              </div>
            </div>
          </div>

          {/* Section: Shipping References */}
          <div className="form-section">
            <h3 className="section-title"><Info size={18} /> Shipment Details</h3>
            <div className="form-grid">
              <div className="input-group">
                <label>Bill of Lading Number</label>
                <input type="text" name="blNumber" value={formData.blNumber} onChange={handleChange} placeholder="e.g. BL-2024-001" />
              </div>
              <div className="input-group">
                <label>Export Reference</label>
                <input type="text" name="exportReference" value={formData.exportReference} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Vessel / Voyage</label>
                <input type="text" name="vesselVoyage" value={formData.vesselVoyage} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Port of Loading & Discharge</label>
                <input type="text" name="portLoadingDischarge" value={formData.portLoadingDischarge} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Place of Receipt</label>
                <input type="text" name="placeOfReceipt" value={formData.placeOfReceipt} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Place of Delivery</label>
                <input type="text" name="placeOfDelivery" value={formData.placeOfDelivery} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Freight Terms</label>
                <input type="text" name="freightTerms" value={formData.freightTerms} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section: Cargo Details */}
          <div className="form-section">
            <h3 className="section-title"><Info size={18} /> Cargo & Packaging</h3>
            <div className="form-grid">
              <div className="input-group">
                <label>Container / Seal No.</label>
                <input type="text" name="containerSealNo" value={formData.containerSealNo} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Marks & Numbers</label>
                <input type="text" name="marksNumbers" value={formData.marksNumbers} onChange={handleChange} />
              </div>
              <div className="input-group full-width">
                <label>Description of Goods</label>
                <textarea name="descriptionGoods" value={formData.descriptionGoods} onChange={handleChange} rows="2" />
              </div>
              <div className="input-group">
                <label>Gross Weight (KG)</label>
                <input type="text" name="grossWeight" value={formData.grossWeight} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Net Weight (KG)</label>
                <input type="text" name="netWeight" value={formData.netWeight} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Measurement (CBM)</label>
                <input type="text" name="measurementCBM" value={formData.measurementCBM} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Number of Original B/L</label>
                <input type="text" name="numOriginalBL" value={formData.numOriginalBL} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section: Execution */}
          <div className="form-section">
            <h3 className="section-title"><Info size={18} /> Execution</h3>
            <div className="form-grid">
              <div className="input-group">
                <label>Place & Date of Issue</label>
                <input type="text" name="placeDateIssue" value={formData.placeDateIssue} onChange={handleChange} />
              </div>
              <div className="input-group span-2">
                <label>Authorized Signature</label>
                <input type="text" name="authorizedSignature" value={formData.authorizedSignature} onChange={handleChange} placeholder="Type name to sign digitally" />
              </div>
            </div>
          </div>
        </form>
      </div>
      
      <style>{`
        .bl-form-container {
          width: 100%;
          max-width: 1400px; /* Increased width */
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .form-header-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .form-header-nav button {
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          white-space: nowrap;
          padding: 0 1.5rem;
          min-width: max-content;
        }
        .action-buttons {
          display: flex;
          gap: 0.75rem;
        }
        .web-form {
          text-align: left;
          padding: 3rem; /* Increased padding */
        }
        .form-title {
          margin-bottom: 2.5rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 1.5rem;
        }
        .form-title h2 {
          margin: 0;
          font-size: 1.8rem;
          color: var(--primary);
        }
        .form-title p {
          margin: 0.5rem 0 0;
          color: #94a3b8;
          font-size: 1rem;
        }
        .form-section {
          margin-bottom: 3rem;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.25rem;
          color: #e2e8f0;
          margin-bottom: 2rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); /* Wider columns */
          gap: 2rem; /* More spacing */
        }
        .full-width {
          grid-column: 1 / -1;
        }
        .span-2 {
          grid-column: span 2;
        }
        .modern-form .input-group {
          margin-bottom: 0;
        }
        .modern-form label {
          display: block;
          margin-bottom: 0.75rem;
          font-size: 0.9rem;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        .modern-form input, .modern-form textarea {
          width: 100%;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          color: white;
          font-family: inherit;
          font-size: 1rem;
          transition: all 0.2s;
        }
        .modern-form input:focus, .modern-form textarea:focus {
          outline: none;
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        /* Large Monitor Adjustments */
        @media (min-width: 1200px) {
          .form-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .web-form {
            padding: 4rem;
          }
        }

        @media (max-width: 1024px) {
          .form-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
          }
          .web-form {
            padding: 2.5rem;
          }
        }

        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
          .span-2 {
            grid-column: auto;
          }
          .web-form {
            padding: 1.5rem;
          }
          .bl-form-container {
            max-width: 100%;
          }
        }
        @media print {
          .form-header-nav, .form-title, .section-title { display: none !important; }
          .glass { background: white !important; color: black !important; border: none !important; box-shadow: none !important; }
          .modern-form input, .modern-form textarea { border: 1px solid #ddd !important; color: black !important; background: transparent !important; }
          .modern-form label { color: #555 !important; }
          .container { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
};

export default BLForm;

