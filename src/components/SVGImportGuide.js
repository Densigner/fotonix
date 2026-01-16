import React from 'react';

const SVGImportGuide = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Make SVGs import as single lines in LightBurn</h1>
      
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>
          ✅ Method 1 (Best, permanent fix): Fix it at the source (Inkscape)
        </h2>
        
        <ol style={styles.list}>
          <li style={styles.listItem}>Select everything</li>
          <li style={styles.listItem}>Open "Fill and Stroke"</li>
          <li style={styles.listItem}>
            Set:
            <ul style={styles.subList}>
              <li>Fill: <strong>None</strong></li>
              <li>Stroke: <strong>ON</strong> (any colour)</li>
            </ul>
          </li>
          <li style={styles.listItem}>
            Set Stroke width to a hairline value (e.g. <code style={styles.code}>0.01 mm</code>)
          </li>
          <li style={styles.listItem}>
            Do <strong>NOT</strong> use "Stroke to Path"
          </li>
          <li style={styles.listItem}>Save the file as "Plain SVG"</li>
        </ol>
      </section>

      <section style={styles.section}>
        <h3 style={styles.resultHeading}>When imported into LightBurn:</h3>
        <ul style={styles.resultList}>
          <li style={styles.resultItem}>✓ You will see single red lines</li>
          <li style={styles.resultItem}>✓ No ladder effect</li>
          <li style={styles.resultItem}>✓ No double lines</li>
          <li style={styles.resultItem}>✓ No extra tools needed</li>
        </ul>
      </section>

      <section style={styles.explanation}>
        <p style={styles.explanationText}>
          <strong>Why this works:</strong> LightBurn treats hairline strokes as true center-lines. 
          Thicker strokes are imported as two edges, which causes the ladder effect.
        </p>
      </section>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    lineHeight: 1.6,
    color: '#333',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '24px',
    color: '#1a1a1a',
    borderBottom: '2px solid #e0e0e0',
    paddingBottom: '12px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2d7d46',
    marginBottom: '16px',
  },
  list: {
    paddingLeft: '24px',
    margin: 0,
  },
  listItem: {
    marginBottom: '12px',
    fontSize: '16px',
  },
  subList: {
    marginTop: '8px',
    paddingLeft: '20px',
    listStyleType: 'disc',
  },
  code: {
    backgroundColor: '#f4f4f4',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  resultHeading: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#1a1a1a',
  },
  resultList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    backgroundColor: '#f0f9f4',
    borderRadius: '8px',
    padding: '16px',
  },
  resultItem: {
    marginBottom: '8px',
    fontSize: '15px',
    color: '#2d7d46',
  },
  explanation: {
    backgroundColor: '#f8f9fa',
    borderLeft: '4px solid #6c757d',
    padding: '16px',
    borderRadius: '0 8px 8px 0',
  },
  explanationText: {
    margin: 0,
    fontSize: '14px',
    color: '#555',
  },
};

export default SVGImportGuide;
