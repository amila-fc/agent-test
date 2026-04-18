import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Download, CheckCircle, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import './App.css';

const ValueRenderer = ({ value }) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div className="nested-container">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="nested-item">
            <span className="nested-key">{k}:</span>
            <span className="nested-value"><ValueRenderer value={v} /></span>
          </div>
        ))}
      </div>
    );
  }
  
  if (Array.isArray(value)) {
    return (
      <ul className="nested-list">
        {value.map((item, i) => (
          <li key={i}><ValueRenderer value={item} /></li>
        ))}
      </ul>
    );
  }

  return <span>{String(value)}</span>;
};

const TableRenderer = ({ data }) => {
  if (!data) return null;
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return <span>No data</span>;

  // Dynamically get all unique keys from all items
  const allKeys = Array.from(new Set(items.flatMap(item => Object.keys(item))));

  // Identify weight columns for totals (fuzzy match)
  const weightKeys = allKeys.filter(k => 
    k.toLowerCase().includes('weight') || 
    k.toLowerCase() === 'net' || 
    k.toLowerCase() === 'gross'
  );

  const calculateTotal = (key) => {
    return items.reduce((sum, item) => {
      const val = item[key];
      return sum + (parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0);
    }, 0);
  };

  return (
    <div className="table-wrapper fading-in">
      <table className="cargo-table">
        <thead>
          <tr>
            {allKeys.map(key => <th key={key}>{key}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              {allKeys.map(key => (
                <td key={key}><ValueRenderer value={item[key]} /></td>
              ))}
            </tr>
          ))}
        </tbody>
        {weightKeys.length > 0 && (
          <tfoot>
            <tr className="total-row">
              <td colSpan={allKeys.indexOf(weightKeys[0])} className="total-label">
                Summary Totals:
              </td>
              {allKeys.slice(allKeys.indexOf(weightKeys[0])).map(key => {
                if (weightKeys.includes(key)) {
                  return <td key={key} className="total-value">{calculateTotal(key).toFixed(2)}</td>;
                }
                return <td key={key}></td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};


function App() {
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/login`, loginForm);
      const { token } = response.data;
      setToken(token);
      localStorage.setItem('token', token);
      setIsLoggedIn(true);
      setStatus('Login successful!');
    } catch (err) {
      console.error(err);
      setStatus('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setFile(null);
    setExtractedData(null);
    setStatus('Logged out.');
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setExtractedData(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus('Uploading and Extracting...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/api/extract`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtractedData(response.data.details);
      setStatus('Details Extracted Successfully!');
    } catch (err) {
      console.error(err);
      setStatus('Error extracting details.');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!extractedData) return;
    setLoading(true);
    setStatus('Generating PDF...');
    
    try {
      const response = await axios.post(`${API_BASE}/api/generate-pdf`, { details: extractedData }, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'shipping_report.pdf');
      document.body.appendChild(link);
      link.click();
      setStatus('PDF Generated!');
    } catch (err) {
      console.error(err);
      setStatus('Error generating PDF.');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="container login-mode">
        <header className="glass">
          <h1>AI Logistics Agent</h1>
          <p>Login to access the dashboard</p>
        </header>
        <main className="glass login-card">
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Username</label>
              <input 
                type="text" 
                value={loginForm.username} 
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                required 
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                value={loginForm.password} 
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                required 
              />
            </div>
            <button type="submit" disabled={loading} className="primary-btn full-width">
              {loading ? <Loader2 className="spinning" /> : 'Login'}
            </button>
            {status && <p className="status-msg error">{status}</p>}
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="glass">
        <div className="header-top">
          <h1>AI Logistics Agent</h1>
          <button onClick={handleLogout} className="logout-btn mini">Logout</button>
        </div>
        <p>Extract details from freight documents instantly</p>
      </header>
      {/* Rest of the dashboard... */}

      <main className="glass">
        <div className="upload-section">
          <label className="file-input-label">
            <input type="file" onChange={handleFileChange} />
            <Upload className="icon" />
            <span>{file ? file.name : 'Choose a file or drag it here'}</span>
          </label>
          <button 
            onClick={handleUpload} 
            disabled={!file || loading}
            className="primary-btn"
          >
            {loading ? <Loader2 className="spinning" /> : 'Extract Details'}
          </button>
        </div>

        {status && <p className="status-msg">{status}</p>}

        {extractedData && (
          <div className="results-section fading-in">
            <div className="results-header">
              <h2>Extracted Logistics Data</h2>
              <button onClick={generatePDF} className="secondary-btn mini">
                <Download size={18} /> Export PDF
              </button>
            </div>
            
            <div className="sequential-sections">
              {Object.entries(extractedData).map(([key, value]) => (
                <div key={key} className="section-card fading-in">
                  <div className="card-label">
                    <CheckCircle size={16} className="check-icon" />
                    {key}
                  </div>
                  <div className="card-value">
                    {key.includes('Cargo') ? (
                      <TableRenderer data={value} />
                    ) : (
                      <ValueRenderer value={value} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer className="glass footer">
        <p>&copy; {new Date().getFullYear()} AI Logistics Agent. Created by amilasilva88</p>
      </footer>
    </div>
  );
}

export default App;
