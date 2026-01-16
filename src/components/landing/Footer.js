import React from 'react';

function Footer({ onProductPageAccess }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-col follow-us">
          <h4>Follow us</h4>
          <ul>
            <li>
                  <a href="https://www.facebook.com/realfotonix" target="_blank" rel="noopener noreferrer">
                  Follow us on Facebook
                  <img src="/images/facebookF.png" alt="Facebook" style={{width: '18px', height: '18px', verticalAlign: 'middle', marginLeft: '8px'}} />
                </a>
            </li>
            <li>
              <a href="#">
                Find us on Reddit
                <img src="/images/bottomRedditLogo.png" alt="Reddit" style={{width: '18px', height: '18px', verticalAlign: 'middle', marginLeft: '8px'}} />
              </a>
            </li>
            <li>
              <a href="https://x.com/FotonixOfficial" target="_blank" rel="noopener noreferrer">
                Find us on X (Twitter)
                <img src="/images/bottomXlogo.png" alt="X" style={{width: '18px', height: '18px', verticalAlign: 'middle', marginLeft: '8px'}} />
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/@StencilGenerator">
                follow our channel on youtube
                <img src="/images/realytlogo.png" alt="YouTube" style={{width: '18px', height: '18px', verticalAlign: 'middle', marginLeft: '8px'}} />
              </a>
            </li>
          </ul>
          
        </div>

        <div className="footer-col discover">
          <h4>Discover</h4>
          <ul>
            <li><a href="#" onClick={(e) => { e.preventDefault(); onProductPageAccess && onProductPageAccess(); }}>Best Selling</a></li>
            <li><a href="#" onClick={(e) => { e.preventDefault(); onProductPageAccess && onProductPageAccess(); }}>Create Your Own</a></li>
            <li><a href="#" onClick={(e) => { e.preventDefault(); onProductPageAccess && onProductPageAccess(); }}>Personalised Neon</a></li>
          </ul>
        </div>

        <div className="footer-col company">
          <h4>Company</h4>
          <ul>
            <li><a href="#">About Us</a></li>
            <li><a href="#">Reviews</a></li>
            <li><a href="#">Blog</a></li>
          </ul>
        </div>

        <div className="footer-col help">
          <h4>Help & Info</h4>
          <ul>
            <li><a href="#">Contact Us</a></li>
            <li><a href="#">Frequently Asked Questions</a></li>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Refund Policy</a></li>
            <li><a href="#">Shipping Policy</a></li>
            <li><a href="#">Terms Of Service</a></li>
          </ul>
        </div>
      </div>

      <div className="container footer-contact">
        <div />

          <div className="we-accept">
            <span>We accept</span>
            <div className="payment-icons">
              <img src="/images/paypalnewest.png" alt="PayPal" style={{height: '28px', width: 'auto', objectFit: 'contain', borderRadius: '6px'}} />
              <img src="/images/bottomvisalogo.png" alt="Visa" style={{height: '28px', width: 'auto', objectFit: 'contain', borderRadius: '6px'}} />
              <img src="/images/bottommastercardlogo.png" alt="Mastercard" style={{height: '28px', width: 'auto', objectFit: 'contain', borderRadius: '6px'}} />
            </div>
          </div>
      </div>

      <div className="container footer-bottom" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <p>Copyright © 2025 Fotonix</p>
        <div>
          <a href="https://x.com/FotonixOfficial" target="_blank" rel="noopener noreferrer" style={{color: '#1DA1F2', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px'}}>
            <img src="/images/bottomXlogo.png" alt="X" style={{width: '18px', height: '18px', verticalAlign: 'middle'}} />
            <span>Follow @FotonixOfficial</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
