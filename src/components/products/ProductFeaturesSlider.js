import React from 'react';
import ModernSlider from './ModernSlider';

function ProductFeaturesSlider() {
  const featureSlides = [
    {
      type: 'custom',
      content: (
        <div className="feature-slide">
          <div className="feature-content">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h3>AI-Powered Insights</h3>
            <p>Get personalized recommendations for your skincare routine, fitness goals, and daily schedule based on advanced AI analysis.</p>
            <ul className="feature-list">
              <li>Skin analysis and care recommendations</li>
              <li>Posture and fitness tracking</li>
              <li>Mood and wellness insights</li>
              <li>Personalized daily briefings</li>
            </ul>
          </div>
          <div className="feature-visual">
            <div className="ai-demo">
              <div className="data-points">
                <div className="data-point pulse">Skin Health: 92%</div>
                <div className="data-point pulse-delayed">Posture Score: 8.5/10</div>
                <div className="data-point pulse-slow">Energy Level: High</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      type: 'custom',
      content: (
        <div className="feature-slide">
          <div className="feature-content">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9H19v2h3v14c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4h3V2h1.5v2h11V2z"/>
              </svg>
            </div>
            <h3>Adaptive Lighting System</h3>
            <p>Revolutionary LED technology that adjusts brightness, warmth, and color temperature throughout the day for optimal visibility and mood enhancement.</p>
            <ul className="feature-list">
              <li>Circadian rhythm synchronization</li>
              <li>Professional makeup lighting modes</li>
              <li>Automatic brightness adjustment</li>
              <li>Color temperature control (2700K-6500K)</li>
            </ul>
          </div>
          <div className="feature-visual">
            <div className="lighting-demo">
              <div className="light-ring">
                <div className="light-segment warm"></div>
                <div className="light-segment neutral"></div>
                <div className="light-segment cool"></div>
                <div className="light-segment bright"></div>
              </div>
              <div className="lighting-control">
                <span className="time-indicator">6:00 AM - Cool & Bright</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    
    {
      type: 'custom',
      content: (
        <div className="feature-slide">
          <div className="feature-content">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
              </svg>
            </div>
            <h3>Health & Wellness Tracking</h3>
            <p>Monitor your health metrics and wellness goals with integrated sensors and AI analysis for a comprehensive view of your daily wellbeing.</p>
            <ul className="feature-list">
              <li>Heart rate and vital sign monitoring</li>
              <li>Sleep pattern analysis</li>
              <li>Stress level assessment</li>
              <li>Workout progress tracking</li>
            </ul>
          </div>
          <div className="feature-visual">
            <div className="health-demo">
              <div className="health-metrics">
                <div className="metric-circle">
                  <div className="metric-value">72</div>
                  <div className="metric-label">BPM</div>
                </div>
                <div className="metric-bars">
                  <div className="metric-bar" style={{height: '60%'}}></div>
                  <div className="metric-bar" style={{height: '80%'}}></div>
                  <div className="metric-bar" style={{height: '45%'}}></div>
                  <div className="metric-bar" style={{height: '90%'}}></div>
                </div>
              </div>
              <div className="wellness-score">
                <span>Wellness Score: 8.7/10</span>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <section className="product-features">
      <div className="container">
        <div className="section-header">
          <h2>Revolutionary Features</h2>
          <p>Discover what makes Fotonix mirrors the most advanced smart mirrors on the market</p>
        </div>
        
        <ModernSlider
          slides={featureSlides}
          autoPlay={true}
          autoPlayInterval={8000}
          showDots={true}
          showArrows={true}
          fadeTransition={true}
          className="features-slider"
        />
      </div>
    </section>
  );
}

export default ProductFeaturesSlider;
