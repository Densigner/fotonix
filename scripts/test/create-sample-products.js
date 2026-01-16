const { Client } = require('pg');
require('dotenv').config();

async function createSampleProducts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Sample products for Fotonix store
    const sampleProducts = [
      {
        owner_uid: 'test_user_1',
        title: 'LED Lumina Mirror - Classic Rectangle',
        description: 'Transform your space with our premium LED mirror featuring warm white lighting, touch controls, and anti-fog technology. Perfect for bathrooms, bedrooms, or vanity areas.',
        price_cents: 8999, // £89.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['mirror', 'led', 'bathroom', 'premium', 'touch-control']),
        category: 'bathroom-mirrors',
        inventory_count: 45,
        sku: 'FTX-LED-REC-001',
        seo_title: 'Premium LED Bathroom Mirror with Touch Controls',
        seo_description: 'High-quality LED mirror with warm lighting and anti-fog. Perfect for modern bathrooms.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Smart Mirror with Voice Control',
        description: 'The future of mirrors is here! Voice-activated smart mirror with weather, news, calendar integration. Features adjustable LED lighting and Bluetooth connectivity.',
        price_cents: 24999, // £249.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['smart-mirror', 'voice-control', 'bluetooth', 'premium', 'tech']),
        category: 'smart-mirrors',
        inventory_count: 12,
        sku: 'FTX-SMART-001',
        seo_title: 'Smart Voice Control Mirror with Apps',
        seo_description: 'Revolutionary smart mirror with voice commands, weather updates, and app integration.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Vintage Round Mirror - Brass Frame',
        description: 'Elegant vintage-style round mirror with authentic brass frame. Handcrafted with attention to detail, perfect for adding character to any room.',
        price_cents: 5999, // £59.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['vintage', 'brass', 'round', 'handcrafted', 'decorative']),
        category: 'decorative-mirrors',
        inventory_count: 28,
        sku: 'FTX-VTG-RND-001',
        seo_title: 'Handcrafted Vintage Brass Round Mirror',
        seo_description: 'Beautiful vintage-style brass framed mirror, handcrafted for lasting elegance.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Hollywood Vanity Mirror with Bulbs',
        description: 'Feel like a star with this Hollywood-style vanity mirror featuring 14 dimmable LED bulbs. Perfect for makeup application with even, shadow-free lighting.',
        price_cents: 12999, // £129.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1631679706909-faf1bdadf7e8?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['hollywood', 'vanity', 'makeup', 'led-bulbs', 'dimmable']),
        category: 'vanity-mirrors',
        inventory_count: 22,
        sku: 'FTX-HLY-VAN-001',
        seo_title: 'Hollywood Vanity Mirror with LED Bulbs',
        seo_description: 'Professional Hollywood-style makeup mirror with 14 dimmable LED bulbs.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Minimalist Frameless Wall Mirror',
        description: 'Clean, modern frameless mirror that seamlessly blends with any contemporary decor. Features polished edges and high-quality silver backing.',
        price_cents: 3999, // £39.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['minimalist', 'frameless', 'modern', 'contemporary', 'wall-mount']),
        category: 'wall-mirrors',
        inventory_count: 67,
        sku: 'FTX-MIN-FRM-001',
        seo_title: 'Modern Frameless Wall Mirror',
        seo_description: 'Sleek frameless mirror with polished edges, perfect for modern homes.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Magnifying Makeup Mirror 10x Zoom',
        description: 'Professional-grade magnifying mirror with 10x magnification. Ideal for detailed makeup application, eyebrow plucking, and skincare routines.',
        price_cents: 2999, // £29.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1607748862156-7c548e7e98f4?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['magnifying', 'makeup', '10x-zoom', 'professional', 'skincare']),
        category: 'specialty-mirrors',
        inventory_count: 89,
        sku: 'FTX-MAG-10X-001',
        seo_title: '10x Magnifying Makeup Mirror for Professionals',
        seo_description: 'High-quality 10x magnification mirror for detailed makeup and skincare.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Antique Gold Ornate Mirror',
        description: 'Exquisite ornate mirror with intricate gold leaf detailing. Reproduction of 18th-century French baroque style, perfect as a statement piece.',
        price_cents: 18999, // £189.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['antique', 'gold', 'ornate', 'baroque', 'statement-piece']),
        category: 'decorative-mirrors',
        inventory_count: 8,
        sku: 'FTX-ANT-GLD-001',
        seo_title: 'Luxury Antique Gold Baroque Mirror',
        seo_description: 'Stunning ornate gold mirror in French baroque style, perfect statement piece.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Custom Shape Mirror - Made to Order',
        description: 'Create your perfect mirror! We can cut any shape you imagine - hexagon, oval, star, or your own custom design. Professional edge polishing included.',
        price_cents: 7999, // £79.99 (starting price)
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['custom', 'bespoke', 'any-shape', 'made-to-order', 'professional']),
        category: 'custom-mirrors',
        inventory_count: 999, // High count for made-to-order
        sku: 'FTX-CST-SHP-001',
        seo_title: 'Custom Shape Mirror - Any Design Made to Order',
        seo_description: 'Professional custom mirror cutting service. Any shape, any size, expertly crafted.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Gym Mirror Tiles - Pack of 4',
        description: 'Professional gym-quality mirror tiles. Shatterproof acrylic construction, easy installation with adhesive backing. Perfect for home gyms and fitness studios.',
        price_cents: 9999, // £99.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['gym', 'fitness', 'shatterproof', 'acrylic', 'pack-of-4']),
        category: 'specialty-mirrors',
        inventory_count: 156,
        sku: 'FTX-GYM-TL4-001',
        seo_title: 'Professional Gym Mirror Tiles Pack of 4',
        seo_description: 'Shatterproof gym mirrors with easy installation. Perfect for home gyms.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Infinity LED Mirror - RGB Color Changing',
        description: 'Mind-bending infinity mirror with RGB LED strips. Creates stunning depth illusion with color-changing effects. Remote control included for customization.',
        price_cents: 15999, // £159.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['infinity', 'rgb', 'color-changing', 'led', 'remote-control']),
        category: 'specialty-mirrors',
        inventory_count: 31,
        sku: 'FTX-INF-RGB-001',
        seo_title: 'RGB Infinity Mirror with Color Changing LEDs',
        seo_description: 'Mesmerizing infinity mirror with RGB LEDs and remote control customization.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Heated Bathroom Mirror - Anti-Fog',
        description: 'Say goodbye to foggy mirrors! Built-in heating element keeps the mirror clear even in the steamiest bathrooms. Energy-efficient and long-lasting.',
        price_cents: 14999, // £149.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['heated', 'anti-fog', 'bathroom', 'energy-efficient', 'steam-proof']),
        category: 'bathroom-mirrors',
        inventory_count: 38,
        sku: 'FTX-HTD-FOG-001',
        seo_title: 'Heated Anti-Fog Bathroom Mirror',
        seo_description: 'Never deal with foggy mirrors again. Built-in heating keeps mirror clear.'
      },
      {
        owner_uid: 'test_user_1',
        title: 'Portable LED Makeup Mirror - Travel Size',
        description: 'Compact folding mirror with built-in LED lighting. Perfect for travel, camping, or small spaces. USB rechargeable with up to 8 hours battery life.',
        price_cents: 1999, // £19.99
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800&auto=format&fit=crop'
        ]),
        tags: JSON.stringify(['portable', 'travel', 'led', 'rechargeable', 'compact']),
        category: 'travel-mirrors',
        inventory_count: 234,
        sku: 'FTX-PRT-LED-001',
        seo_title: 'Portable LED Travel Makeup Mirror',
        seo_description: 'Compact rechargeable LED mirror perfect for travel and small spaces.'
      }
    ];

    console.log('Inserting sample products...');
    let insertedCount = 0;

    for (const product of sampleProducts) {
      try {
        await client.query(`
          INSERT INTO products (
            owner_uid, 
            title, 
            description, 
            price_cents, 
            images, 
            tags, 
            category, 
            inventory_count,
            sku,
            seo_title,
            seo_description,
            status
          ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, 'active')
        `, [
          product.owner_uid,
          product.title,
          product.description,
          product.price_cents,
          product.images,
          product.tags,
          product.category,
          product.inventory_count,
          product.sku,
          product.seo_title,
          product.seo_description
        ]);
        insertedCount++;
        console.log(`✅ Added: ${product.title} (£${(product.price_cents / 100).toFixed(2)})`);
      } catch (error) {
        if (error.code === '23505') { // Unique constraint violation (duplicate SKU)
          console.log(`⚠️  Skipped duplicate: ${product.title}`);
        } else {
          console.error(`❌ Error inserting ${product.title}:`, error.message);
        }
      }
    }
    
    // Show final summary
    const totalCount = await client.query('SELECT COUNT(*) FROM products WHERE owner_uid = $1', ['test_user_1']);
    console.log(`\n🎉 Process complete!`);
    console.log(`📦 Successfully added ${insertedCount} new products`);
    console.log(`📊 Total products for test_user_1: ${totalCount.rows[0].count}`);

    // Show sample of what was added
    const recentProducts = await client.query(`
      SELECT title, price_cents, category, inventory_count 
      FROM products 
      WHERE owner_uid = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, ['test_user_1']);
    
    console.log('\n📋 Recent products:');
    recentProducts.rows.forEach(product => {
      console.log(`  - ${product.title} (£${(product.price_cents / 100).toFixed(2)}) - ${product.category} - Stock: ${product.inventory_count}`);
    });

  } catch (error) {
    console.error('❌ Failed to create sample products:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

createSampleProducts();