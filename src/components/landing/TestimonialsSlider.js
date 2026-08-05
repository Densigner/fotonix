import React, { useState } from "react";
import { motion } from "framer-motion";

 
export default function SocialProofSection({ showQuoteMark = false } ) {
  const slides = [
    {
      quote:
        "The Fotonix Lumina Mirror has completely transformed my morning routine. The AI insights about my skin health and the perfect lighting for makeup application are game-changers. I feel more confident and prepared for my day.",
      name: "Sarah Johnson",
      title: "Marketing Executive, London",
      // sarah-johnson.jpg is not present in the repo's public/images/testimonials folder; use an existing placeholder
      img: "/images/testimonials/tryneonprod.png",
    },
    {
      quote:
        "As a busy professional, the smart home integration features are incredible. I can control my entire house while getting ready in the morning. The voice commands work flawlessly, and the display quality is stunning.",
      name: "Michael Chen",
      title: "Tech Entrepreneur, Manchester",
      img: "/images/testimonials/michael-chen.jpg",
    },
    {
      quote:
        "The health and wellness tracking features have motivated me to maintain better habits. Seeing my daily progress and getting personalized recommendations right in my mirror makes staying healthy feel effortless.",
      name: "Emma Williams",
      title: "Fitness Instructor, Birmingham",
      img: "/images/testimonials/emma-williams.jpg",
    },
    {
      quote:
        "Installation was seamless and the customer support team was exceptional. The mirror's adaptive lighting system has improved my sleep quality by syncing with my circadian rhythm. Best investment I've made for my home.",
      name: "David Thompson",
      title: "Architect, Edinburgh",
      img: "/images/testimonials/david-thompson.jpg",
    },
  ];

  const [index, setIndex] = useState(0);
  const next = () => setIndex((p) => (p + 1) % slides.length);
  const prev = () => setIndex((p) => (p - 1 + slides.length) % slides.length);
  const current = slides[index];

  return (
    <section className="social-proof-section">
      <div className="container">
        {/* Header */}
        <motion.div
          className="sp-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <div className="trust-bar">
            <div className="trust-left">
              <div className="badge-combo">
                <span className="verified">Verified by</span>

                {/* Endorsed.Review badge (SVG, transparent outside) */}
    <a href="https://endorsed.review/#/biz/fotonix" target="_blank" rel="noopener noreferrer">
 <img  src="/endorsedborder.svg"
  alt="Endorsed.Review"
  className="er-badge"
/></a>
              </div>
              <p className="microcopy">Verified by real customers — vetted through Endorsed.Review</p>
            </div>

            <div className="trust-right">
              <a
                href="https://endorsed.review/#/biz/fotonix"
                target="_blank"
                rel="noopener noreferrer"
                className="review-link"
              >
                <div className="rating">
                  <svg
                    className="rating-star"
                    viewBox="0 0 40 40"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <polygon
                      fill="#FFD43B"
                      points="20,0 24.755,12.36 38,12.36 27,20.04 30.9,32 20,24.8 9.1,32 13,20.04 2,12.36 15.245,12.36"
                    />
                  </svg>
                  <strong>4.8/5</strong>
                </div>
                <div className="reviews">1218+ verified reviews</div>
              </a>
            </div>
          </div>
        </motion.div>

        {/* Carousel */}
        <motion.div
          className="carousel-wrapper"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <div className="carousel-inner">
            <motion.div
              key={index}
              className="slide"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5 }}
            >
              <div className={`testimonial-card ${showQuoteMark ? "with-quote" : ""}`}>
                {showQuoteMark && (
                  <svg className="quote-mark" viewBox="0 0 64 64" aria-hidden="true">
                    <path
                      d="M26 12c-7 0-12 5-12 12 0 4 2 8 5 10-4 3-7 8-7 14h12c0-7 6-12 10-16 3-3 6-7 6-12 0-10-6-18-14-18zm28 0c-7 0-12 5-12 12 0 4 2 8 5 10-4 3-7 8-7 14h12c0-7 6-12 10-16 3-3 6-7 6-12 0-10-6-18-14-18z"
                      fill="rgba(255,212,59,.9)"
                    />
                  </svg>
                )}

                <blockquote>{current.quote}</blockquote>

                <div className="author">
                  <img src={current.img} alt={current.name} />
                  <div className="info">
                    <h4>{current.name}</h4>
                    <p>{current.title}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <button className="nav-btn left" onClick={prev} aria-label="Previous testimonial">
            ‹
          </button>
          <button className="nav-btn right" onClick={next} aria-label="Next testimonial">
            ›
          </button>
        </motion.div>

        {/* Proof strip */}
        <motion.div
          className="proof-strip"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <span>Free Design Proof</span>
          <span>2-Year Warranty</span>
          <span>Ships in 3–5 Days</span>
          <span>24/7 Support</span>
        </motion.div>
      </div>

      <style>{`
        .social-proof-section { background: linear-gradient(180deg,#ffffff 0%,#f9fafb 100%); padding: 80px 20px; text-align: center; }
        .container { max-width: 1000px; margin: 0 auto; }
        .trust-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:24px; text-align:left; }
        .trust-left { display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
        .badge-combo { display:flex; align-items:center; gap:10px; }
        .verified { text-transform:uppercase; letter-spacing:0.06em; font-size:12px; color:#6b7280; }
        .er-badge { height:34px; width:auto; filter:drop-shadow(0 2px 6px rgba(0,0,0,.15)); transition:transform 0.4s ease; }
        .er-badge:hover { transform:translateY(-2px) scale(1.02); }
        .microcopy { font-size:13px; color:#6b7280; }

        .trust-right { text-align:right; }
        .trust-right .rating { font-size:20px; font-weight:700; color:#111; display:flex; align-items:center; justify-content:flex-end; gap:6px; }
        .rating-star { height:20px; width:20px; flex-shrink:0; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15)); transform:translateY(-1px); }
        .trust-right .reviews { font-size:14px; color:#6b7280; }

        /* Micro-interactions & subtle depth */
        .trust-bar,
        .proof-strip span,
        .testimonial-card {
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Slight lift on hover */
        .er-badge:hover,
        .proof-strip span:hover,
        .testimonial-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        /* Refined hierarchy */
        .verified {
          font-size: 11px;
          letter-spacing: 0.08em;
          color: #9ca3af;
          text-transform: uppercase;
        }
        .trust-right .rating strong {
          font-size: 22px;
          color: #111;
        }
        .trust-right .reviews {
          font-size: 13px;
          color: #6b7280;
        }

        /* Review link styling with branded yellow underline on hover */
        .review-link {
          text-decoration: none;
          color: inherit;
          display: inline-flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          transition: all 0.25s ease;
        }

        .review-link:hover strong,
        .review-link:hover .reviews {
          text-decoration: underline;
          text-decoration-color: #FFD43B;
          text-underline-offset: 3px;
        }

        /* Testimonial typography tweaks */
        .testimonial-card blockquote {
          font-size: 18px;
          line-height: 1.7;
          max-width: 640px;
          margin: 0 auto;
        }

        blockquote::before {
          content: "\u201C";
          color: #FFD43B;
          font-size: 50px;
          position: absolute;
          left: -20px;
          top: -10px;
          opacity: 0.25;
          pointer-events: none;
        }

        /* Mobile refinement */
        @media (max-width: 480px) {
          .social-proof-section {
            padding: 50px 16px;
          }
          .testimonial-card {
            padding: 24px;
          }
        }

        /* Optional logos strip */
        .logos-strip {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 30px;
          margin-top: 40px;
          opacity: 0.6;
        }
        .logos-strip img {
          height: 22px;
          filter: grayscale(1);
          transition: all 0.3s ease;
        }
        .logos-strip img:hover {
          filter: none;
          opacity: 1;
        }

        .carousel-wrapper { position:relative; margin-top:50px; overflow:visible; }
        .carousel-inner { position:relative; min-height:260px; }
        
        .testimonial-card { 
          position:relative; 
          background:#fff; 
          border-radius:16px; 
          padding:30px; 
          box-shadow:0 8px 30px rgba(0,0,0,.08); 
          max-width:700px; 
          margin:0 auto; 
          border:1px solid rgba(17,17,17,.05); 
        }
        .testimonial-card blockquote { 
          margin:0; 
          font-size:18px; 
          line-height:1.6; 
          color:#1f2937; 
        }
        /* Optional quote mark — absolute so it creates no gap */
        .testimonial-card .quote-mark {
          position:absolute;
          top:18px;
          left:18px;
          width:38px;
          height:38px;
          display:block;
          pointer-events:none;
        }
        .testimonial-card.with-quote blockquote { padding-left:58px; } /* room for the mark */

        .author { display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px; }
        .author img { width:50px; height:50px; border-radius:50%; object-fit:cover; }
        .author h4 { margin:0; font-size:16px; }
        .author p { margin:0; color:#6b7280; font-size:14px; }

        .nav-btn { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.7); border:none; width:46px; height:46px; border-radius:50%; cursor:pointer; font-size:28px; line-height:0; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.15); transition:all .3s ease; }
        .nav-btn:hover { background:#FFD43B; color:#111; transform:translateY(-50%) scale(1.05); }
        .nav-btn.left { left:-70px; }
        .nav-btn.right { right:-70px; }
        @media(max-width:900px){ .nav-btn.left{left:-30px;} .nav-btn.right{right:-30px;} }
        @media(max-width:600px){ .nav-btn{width:38px;height:38px;font-size:22px;} }

        .proof-strip { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:50px; color:#3f3f46; font-size:13px; font-weight:600; }
        .proof-strip span { background:rgba(255,212,59,.18); border:1px solid rgba(255,212,59,.6); border-radius:999px; padding:8px 14px; }

        @media (max-width: 800px) {
          .trust-bar { flex-direction:column; text-align:center; }
          .trust-left, .trust-right { align-items:center; text-align:center; }
        }
      `}</style>
    </section>
  );
}
