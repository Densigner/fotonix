import React from 'react';

function InfoBar() {
  return (
    <div className="info-bar">
      <div className="info-container">
        <div className="info-segment">
          <picture>
            <source srcSet="/images/customDesign.png" type="image/png" />
            <img src="/images/customDesign.svg" alt="Custom design" />
          </picture>
          <div className="info-text">
            <h4>Completely Customisable</h4>
            <p>Completely customisable designs with infinite possibilities</p>
          </div>
        </div>

        <div className="info-segment">
          <img src="/images/bristishouttline.png" alt="Made in Britain" />
          <div className="info-text">
            <h4>Made In Britain</h4>
            <p>Proudly designed and manufactured in Britain</p>
          </div>
        </div>

        <div className="info-segment">
          <picture>
            <source srcSet="/images/customerService.png" type="image/png" />
            <img src="/images/customerservice.svg" alt="Customer service" />
          </picture>
          <div className="info-text">
            <h4>Customer Service</h4>
            <p>Great customer service to help you every step of the way</p>
          </div>
        </div>

        <div className="info-segment">
          <img src="/images/deliveryvan.png" alt="Delivery van" />
          <div className="info-text">
            <h4>Rapid Delivery</h4>
            <p>Fast delivery between <br></br>3 and 5 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InfoBar;
