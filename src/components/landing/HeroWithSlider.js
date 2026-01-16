import React from 'react';
import ModernSlider from '../shared/ModernSlider';
import '../shared/ModernSlider.css';

function HeroWithSlider({ onShop }) {
  // Sample slides data - replace with your actual images and content
  const heroSlides = [
    {
      type: 'image',
      src: '/images/hero/hero-slide-1.jpg', // Add your actual hero image here
      alt: 'Fotonix Lumina Mirror in modern bathroom',
      overlay: true,
      title: 'Fotonix Lumina Mirror',
      subtitle: 'The Future of Smart Mirrors',
      description: 'Transform your daily routine with revolutionary smart mirror technology. Experience perfect lighting, smart connectivity, and elegant design.',
      cta: {
        text: 'Shop Now',
        action: () => {
          if (onShop) return onShop();
          try { window.location.hash = 'product'; } catch(e){}
        }
      }
    },
    {
      type: 'image',
      src: '/images/hero/hero-slide-2.jpg', // Add your AI features image here
      alt: 'Smart mirror features demonstration',
      overlay: true,
      title: 'AI-Powered Intelligence',
      subtitle: 'Voice Control & Smart Integration',
      description: 'Control your entire smart home ecosystem through your mirror. Get weather updates, news, and personal insights.',
      cta: {
        text: 'Learn More',
        action: () => console.log('Navigate to features')
      }
    },
    {
      type: 'image',
      src: '/images/hero/hero-slide-3.jpg', // Add your lighting demo image here
      alt: 'Perfect lighting demonstration',
      overlay: true,
      title: 'Perfect Lighting',
      subtitle: 'Adaptive Illumination Technology',
      description: 'Our advanced LED system adapts to your environment and time of day for optimal lighting in any situation.',
      cta: {
        text: 'Discover Technology',
        action: () => console.log('Navigate to technology')
      }
    },
    {
      type: 'custom',
      content: (
        <div className="hero-interactive-slide">
          <div className="interactive-content">
            <div className="mirror-demo">
              <div className="mirror-frame-large">
                <div className="mirror-display-animated">
                  <div className="time-widget">12:34 PM</div>
                  <div className="weather-widget">
                    <span className="temp">22°C</span>
                    <span className="condition">Sunny</span>
                  </div>
                  <div className="mirror-reflection">
                    <div className="user-silhouette"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="interactive-text">
              <h2>Experience the Magic</h2>
              <h3>Interactive Smart Mirror Demo</h3>
              <p>See how our smart mirror seamlessly integrates into your daily routine with real-time information and stunning visuals.</p>
              <div className="demo-features">
                <div className="feature-tag">Real-time Weather</div>
                <div className="feature-tag">Voice Commands</div>
                <div className="feature-tag">Smart Home Control</div>
                <div className="feature-tag">Fitness Tracking</div>
              </div>
              <button className="slide-cta">Start Demo</button>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <section className="hero">
      <ModernSlider
        slides={heroSlides}
        autoPlay={true}
        autoPlayInterval={6000}
        showDots={true}
        showArrows={true}
        fadeTransition={false}
        className="hero-slider"
      />
    </section>
  );
}

export default HeroWithSlider;
