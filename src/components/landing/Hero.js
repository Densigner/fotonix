import React from 'react';

const gradientBtn = "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl px-4 py-2 font-semibold";

function Hero({ onShop }) {
  const handleShop = (e) => {
    if (onShop) return onShop();
    try { window.location.href = '/#product'; } catch (err) {}
  };

  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-image-grid">
          <div className="hero-main image-card">
            {/* Replace backgroundImage URL with your actual large image when available */}
            <div className="image-media" style={{backgroundImage: "url('/images/AmeliaBedroom.png')"}} />
            <div className="image-overlay">
              <button onClick={handleShop} className={gradientBtn}>Shop Main</button>
              <div className="image-label">See Our Premade Style Catalogue</div>
            </div>
          </div>

          <div className="hero-side">
            <div className="side-image image-card">
              <div className="image-media" style={{backgroundImage: "url('/images/phonefrontpage.png')"}} />
              <div className="image-overlay">
                <button className={gradientBtn}>Find Out More</button>
                <div className="image-label">The Most Advanced <br></br> Colour and Pattern Control</div>
              </div>
            </div>

            <div className="side-image image-card">
              <div className="image-media" style={{backgroundImage: "url('/images/usethisonfrontscreen.png')"}} />
              <div className="image-overlay">
                <button className={gradientBtn}>Check It Out</button>
                <div className="image-label">Fully Customisable, Upload your own pictures</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
