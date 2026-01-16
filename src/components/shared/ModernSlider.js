import React, { useState, useEffect, useCallback } from 'react';

const ModernSlider = ({ 
  slides, 
  autoPlay = true, 
  autoPlayInterval = 5000,
  showDots = true,
  showArrows = true,
  fadeTransition = false,
  className = ""
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !autoPlay) return;
    
    const interval = setInterval(nextSlide, autoPlayInterval);
    return () => clearInterval(interval);
  }, [isPlaying, autoPlay, autoPlayInterval, nextSlide]);

  // Pause on hover
  const handleMouseEnter = () => setIsPlaying(false);
  const handleMouseLeave = () => setIsPlaying(autoPlay);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  return (
    <div 
      className={`modern-slider ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label="Image carousel"
    >
      <div className="slider-container">
        <div 
          className={`slides-wrapper ${fadeTransition ? 'fade-transition' : 'slide-transition'}`}
          style={{
            transform: fadeTransition ? 'none' : `translateX(-${currentSlide * 100}%)`,
            opacity: fadeTransition ? 1 : undefined
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`slide ${index === currentSlide ? 'active' : ''}`}
              style={{
                opacity: fadeTransition ? (index === currentSlide ? 1 : 0) : 1
              }}
            >
              {slide.type === 'image' ? (
                <div className="slide-image">
                  <img 
                    src={slide.src} 
                    alt={slide.alt || `Slide ${index + 1}`}
                    loading="lazy"
                  />
                  {slide.overlay && (
                    <div className="slide-overlay">
                      <div className="slide-content">
                        {slide.title && <h2>{slide.title}</h2>}
                        {slide.subtitle && <h3>{slide.subtitle}</h3>}
                        {slide.description && <p>{slide.description}</p>}
                        {slide.cta && (
                          <button 
                            className="slide-cta"
                            onClick={slide.cta.action}
                          >
                            {slide.cta.text}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="slide-custom">
                  {slide.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {showArrows && slides.length > 1 && (
          <>
            <button
              className="slider-arrow slider-arrow-prev"
              onClick={prevSlide}
              aria-label="Previous slide"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <button
              className="slider-arrow slider-arrow-next"
              onClick={nextSlide}
              aria-label="Next slide"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </>
        )}

        {/* Dots Navigation */}
        {showDots && slides.length > 1 && (
          <div className="slider-dots">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`slider-dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Progress Bar */}
        {autoPlay && isPlaying && (
          <div className="slider-progress">
            <div 
              className="slider-progress-bar"
              style={{
                animationDuration: `${autoPlayInterval}ms`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernSlider;
