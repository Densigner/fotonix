import React from 'react';

function About() {
  return (
    <section className="about-section container" aria-labelledby="about-heading">
      <h2 id="about-heading">Lighting Up a Greener Future</h2>

      <p>
        We’re a small, family‑run company based in St Helens. Every purchase from Fotonix helps to support a local
        business — real people designing, building and finishing each product by hand here in England. Our signs are
        manufactured in the UK using durable, recyclable materials so you can enjoy them for years while knowing you’ve
        backed a small maker.
      </p>

      <p>
        Want to stay in the loop? <a href="#newsletter" className="about-link">Join our newsletter</a> for product drops,
        behind‑the‑scenes updates and small‑business offers.
      </p>
    </section>
  );
}

export default About;
