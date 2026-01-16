import React, { useEffect, useRef, useState } from 'react';

const PayPalCheckout = ({ amount, currency = 'GBP', productId = null, ownerId = null, onSuccess, onError, onCancel }) => {
  const paypalRef = useRef();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Your PayPal Client ID
  const CLIENT_ID = 'Aab6IHfog5quDJp4kfy5sqiuo4YcTZaQ3SR8VpwUgDoDphLXmrKwqhog_u-cktkgIaSrsXwxH8HNE-Jf';

  useEffect(() => {
    let scriptTimeout;
    
    const loadPayPalScript = () => {
      console.log('Starting to load PayPal SDK...');
      
      // Check if PayPal script is already loaded
      if (window.paypal) {
        console.log('PayPal already loaded, initializing...');
        initializePayPal();
        return;
      }

      // Remove any existing PayPal scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
      existingScripts.forEach(script => script.remove());

      // Create and load PayPal script
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=${currency}&intent=capture`;
      script.async = true;
      
      // Set a timeout to prevent infinite loading
      scriptTimeout = setTimeout(() => {
        console.error('PayPal script loading timeout');
        setIsError(true);
        setErrorMessage('PayPal is taking too long to load. Please check your internet connection.');
        setIsLoading(false);
      }, 10000); // 10 second timeout
      
      script.onload = () => {
        console.log('PayPal SDK loaded successfully');
        clearTimeout(scriptTimeout);
        // Small delay to ensure PayPal is fully ready
        setTimeout(() => {
          initializePayPal();
        }, 100);
      };
      
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        clearTimeout(scriptTimeout);
        setIsError(true);
        setErrorMessage('Failed to load PayPal. Please check your internet connection.');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    const initializePayPal = () => {
      if (!window.paypal) {
        console.error('PayPal object not found');
        setIsError(true);
        setErrorMessage('PayPal failed to initialize properly.');
        setIsLoading(false);
        return;
      }

      if (!paypalRef.current) {
        console.error('PayPal container not found');
        setIsError(true);
        setErrorMessage('PayPal container not ready.');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Initializing PayPal buttons...');
        
        // Clear any existing PayPal buttons
        paypalRef.current.innerHTML = '';

        window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal',
            height: 40
          },
          createOrder: (data, actions) => {
            console.log('Creating PayPal order via server for amount:', amount);
            // Create the order on the server so we can attach the aff_click custom_id server-side
            return fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [{ name: 'Fotonix Product', unitAmount: amount, quantity: 1 }], currency })
            }).then(r => r.json()).then(j => j.id);
          },
          onApprove: async (data, actions) => {
            console.log('PayPal payment approved:', data);
            try {
              // Use server-side capture so we can send owner notification emails
              const response = await fetch('/api/paypal/capture-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  orderId: data.orderID,
                  productId: productId || null,
                  ownerId: ownerId || null
                })
              });
              
              if (!response.ok) {
                throw new Error('Failed to capture order');
              }
              
              const details = await response.json();
              console.log('Payment captured:', details);
              
              if (onSuccess) {
                onSuccess({
                  orderID: data.orderID,
                  payerID: data.payerID,
                  paymentID: data.paymentID,
                  details: details
                });
              }
            } catch (error) {
              console.error('Error capturing payment:', error);
              if (onError) {
                onError(error);
              }
            }
          },
          onError: (err) => {
            console.error('PayPal button error:', err);
            if (onError) {
              onError(err);
            }
          },
          onCancel: (data) => {
            console.log('PayPal payment cancelled:', data);
            if (onCancel) {
              onCancel(data);
            }
          }
        }).render(paypalRef.current).then(() => {
          console.log('PayPal buttons rendered successfully');
          setIsLoading(false);
        }).catch((error) => {
          console.error('Error rendering PayPal buttons:', error);
          setIsError(true);
          setErrorMessage('Failed to initialize PayPal buttons.');
          setIsLoading(false);
        });
        
      } catch (error) {
        console.error('Error initializing PayPal:', error);
        setIsError(true);
        setErrorMessage('Failed to initialize PayPal.');
        setIsLoading(false);
      }
    };
    loadPayPalScript();

    // Cleanup function
    return () => {
      if (scriptTimeout) {
        clearTimeout(scriptTimeout);
      }
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
    };
  }, [amount, currency, CLIENT_ID, productId, ownerId, onSuccess, onError, onCancel]);

  if (isError) {
    return (
      <div className="paypal-error">
        <div className="error-icon">⚠️</div>
        <p>{errorMessage || 'Unable to load PayPal. Please refresh the page or try again later.'}</p>
        <button 
          className="retry-button"
          onClick={() => {
            setIsError(false);
            setIsLoading(true);
            setErrorMessage('');
            
            // Try to reload without full page refresh
            if (window.paypal) {
              // PayPal is already loaded, just re-initialize
              if (paypalRef.current) {
                try {
                  paypalRef.current.innerHTML = '';
                  window.paypal.Buttons({
                    style: {
                      layout: 'vertical',
                      color: 'blue',
                      shape: 'rect',
                      label: 'paypal',
                      height: 40
                    },
                    createOrder: (data, actions) => {
                      return fetch('/api/paypal/create-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: [{ name: 'Fotonix Product', unitAmount: amount, quantity: 1 }], currency })
                      }).then(r => r.json()).then(j => j.id);
                    },
                    onApprove: async (data, actions) => {
                      try {
                        // Use server-side capture for owner notifications
                        const response = await fetch('/api/paypal/capture-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            orderId: data.orderID,
                            productId: productId || null,
                            ownerId: ownerId || null
                          })
                        });
                        
                        if (!response.ok) throw new Error('Failed to capture order');
                        
                        const details = await response.json();
                        if (onSuccess) {
                          onSuccess({
                            orderID: data.orderID,
                            payerID: data.payerID,
                            paymentID: data.paymentID,
                            details: details
                          });
                        }
                      } catch (error) {
                        if (onError) onError(error);
                      }
                    },
                    onError: (err) => {
                      if (onError) onError(err);
                    },
                    onCancel: (data) => {
                      if (onCancel) onCancel(data);
                    }
                  }).render(paypalRef.current).then(() => {
                    setIsLoading(false);
                  }).catch((error) => {
                    setIsError(true);
                    setErrorMessage('Failed to initialize PayPal buttons.');
                    setIsLoading(false);
                  });
                } catch (error) {
                  setIsError(true);
                  setErrorMessage('Failed to initialize PayPal.');
                  setIsLoading(false);
                }
              }
            } else {
              // Reload the script
              const loadScript = () => {
                const script = document.createElement('script');
                script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=${currency}&intent=capture`;
                script.async = true;
                script.onload = () => {
                  if (window.paypal && paypalRef.current) {
                    setIsLoading(false);
                    // The useEffect will handle initialization
                  }
                };
                script.onerror = () => {
                  setIsError(true);
                  setErrorMessage('Still unable to connect to PayPal. Please check your internet connection.');
                  setIsLoading(false);
                };
                document.head.appendChild(script);
              };
              setTimeout(loadScript, 1000);
            }
          }}
        >
          Retry PayPal
        </button>
        
        {/* Fallback Demo Button */}
        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
            Or try our demo payment:
          </p>
          <button 
            className="demo-paypal-button"
            onClick={() => {
              if (onSuccess) {
                onSuccess({
                  orderID: 'DEMO_' + Date.now(),
                  payerID: 'DEMO_PAYER',
                  paymentID: 'DEMO_PAYMENT',
                  details: { id: 'DEMO_' + Date.now(), status: 'COMPLETED' }
                });
              }
            }}
          >
            💳 Demo Payment - £{amount}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="paypal-loading">
        <div className="loading-spinner"></div>
        <p>Loading PayPal...</p>
      </div>
    );
  }

  return (
    <div className="paypal-checkout">
      <div ref={paypalRef} className="paypal-button-container"></div>
    </div>
  );
};

export default PayPalCheckout;
