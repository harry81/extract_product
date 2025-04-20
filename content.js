// This script runs on product pages to extract product data when requested

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Content script received message:', request);
  
  if (request.action === "crawlProducts") { // Action name remains the same for compatibility
    console.log('Executing extractProducts action');
    const products = extractProducts();
    sendResponse({products: products});
  } else if (request.action === "showCompletionEffect") {
    console.log('Executing showCompletionEffect with count:', request.productCount);
    showCollectionCompleteEffect(request.productCount);
    sendResponse({success: true});
  }
  return true; // Keep the message channel open for async response
});

// Function to show visual effect when extraction is complete
function showCollectionCompleteEffect(productCount) {
  console.log('Starting showCollectionCompleteEffect with count:', productCount);
  // Create and inject the CSS for the animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes collection-complete-pulse {
      0% { opacity: 0; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.1); }
      100% { opacity: 0; transform: scale(1.5); }
    }

    .extraction-complete-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: none;
      animation: collection-complete-fade 3s forwards;
    }

    @keyframes collection-complete-fade {
      0% { opacity: 0; }
      10% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }

    .extraction-complete-container {
      background-color: white;
      border-radius: 12px;
      padding: 30px 50px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: 'Noto Sans KR', sans-serif, system-ui;
      transform: scale(0.8);
      animation: collection-complete-pop 0.5s forwards;
    }
    
    @keyframes collection-complete-pop {
      0% { transform: scale(0.9); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    .collection-complete-icon {
      width: 100px;
      height: 100px;
      background-color: #4CAF50;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 20px;
      position: relative;
    }

    .collection-complete-icon::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      background-color: #4CAF50;
      border-radius: 50%;
      animation: collection-complete-pulse 1.5s infinite;
    }

    .collection-complete-icon::after {
      content: '';
      width: 40px;
      height: 20px;
      border-left: 6px solid white;
      border-bottom: 6px solid white;
      transform: rotate(-45deg) translate(5px, -5px);
      z-index: 1;
    }

    .extraction-complete-title {
      font-size: 26px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #333;
    }

    .extraction-complete-count {
      font-size: 20px;
      color: #666;
      margin-bottom: 16px;
    }
  `;
  document.head.appendChild(style);

  // Create the overlay element
  const overlay = document.createElement('div');
  overlay.className = 'extraction-complete-overlay';

  // Create the container
  const container = document.createElement('div');
  container.className = 'extraction-complete-container';

  // Create the icon
  const icon = document.createElement('div');
  icon.className = 'extraction-complete-icon';

  // Create the title
  const title = document.createElement('div');
  title.className = 'extraction-complete-title';
  title.textContent = '추출 완료!';

  // Create the count
  const count = document.createElement('div');
  count.className = 'extraction-complete-count';
  count.textContent = `${productCount}개의 제품 정보를 추출했습니다.`;

  // Assemble the elements
  container.appendChild(icon);
  container.appendChild(title);
  container.appendChild(count);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  console.log('Visual effect overlay added to DOM');

  // Remove the overlay after animation completes
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    if (document.head.contains(style)) {
      document.head.removeChild(style);
    }
  }, 3000);
}

// Function to extract products from the current page
function extractProducts() {
  const products = [];
  
  try {
    // Try different selectors for product listings
    // Main product grid items
    const productItems = document.querySelectorAll('li.search-product, ul.productList li, .baby-product, article.product');
    
    if (productItems.length > 0) {
      productItems.forEach(item => {
        try {
          // Find product link
          const linkElement = item.querySelector('a');
          if (!linkElement) return;
          
          // Get product URL
          let productUrl = linkElement.href;
          if (!productUrl.startsWith('http')) {
            // Handle relative URLs by prepending the current domain
            if (productUrl.startsWith('/')) {
              const currentDomain = window.location.origin;
              productUrl = currentDomain + productUrl;
            }
          }
          
          // Get product title
          const titleElement = item.querySelector('.name, .product-name, .title, .baby-product-link, .description');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          // Get product image
          const imageElement = item.querySelector('img.search-product-wrap-img, img.product-image, img');
          let imageUrl = '';
          if (imageElement) {
            // Try different image attributes
            imageUrl = imageElement.src || imageElement.getAttribute('data-src') || '';
          }
          
          // Extract product ID (unique identifier for the item)
          let productId = '';
          try {
            // First, check if the item itself has an ID attribute (highest priority)
            if (item.id && item.id.match(/\d+/)) {
              productId = item.id.match(/\d+/)[0];
            }
            // Then check data attributes which are commonly used
            else if (item.dataset && item.dataset.productId) {
              productId = item.dataset.productId;
            } 
            else if (item.getAttribute('data-product-id')) {
              productId = item.getAttribute('data-product-id');
            } 
            else if (item.getAttribute('data-item-id')) {
              productId = item.getAttribute('data-item-id');
            }
            
            // If still no ID, try to find it in nested elements
            if (!productId) {
              // Look for ID in various formats
              const idElement = item.querySelector('[data-product-id], [data-item-id], [data-itemid], [data-vendor-item-id]');
              if (idElement) {
                productId = idElement.getAttribute('data-product-id') || 
                           idElement.getAttribute('data-item-id') || 
                           idElement.getAttribute('data-itemid') ||
                           idElement.getAttribute('data-vendor-item-id');
              }
              
              // Try to find ID in product URL (common in product links)
              if (!productId && productUrl) {
                const urlMatch = productUrl.match(/products?\/([0-9]+)/);
                if (urlMatch && urlMatch[1]) {
                  productId = urlMatch[1];
                }
                
                // Also check for itemId parameter in URL
                const itemIdMatch = productUrl.match(/itemId=([0-9]+)/);
                if (itemIdMatch && itemIdMatch[1]) {
                  // This is the item ID, not product ID, but can be useful if product ID is not found
                  if (!productId) {
                    productId = itemIdMatch[1];
                  }
                }
              }
              
              // Try to find ID in any element with a numeric ID attribute
              if (!productId) {
                const elementsWithId = item.querySelectorAll('[id]');
                for (const el of elementsWithId) {
                  const idMatch = el.id.match(/([0-9]+)/);
                  if (idMatch && idMatch[1]) {
                    productId = idMatch[1];
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error extracting product ID:', e);
          }

          // Extract price
          let price = '';
          try {
            // First try to find the specific price-value element (highest priority)
            const priceValueElement = item.querySelector('strong.price-value');
            if (priceValueElement) {
              price = priceValueElement.textContent.trim();
              // Clean up price (remove currency symbols, commas, etc.)
              price = price.replace(/[^0-9]/g, '');
            }
            
            // If not found, try other common price selectors
            if (!price) {
              const priceElement = item.querySelector('.price-value, .price, .product-price, .price-area .value, .search-product-wrap-price, .price-info .price, .price-info .sale strong, .price-info .sale, .search-product-price-info .price, .search-product-price-info .price-value, .price-area, .price-info');
              
              if (priceElement) {
                price = priceElement.textContent.trim();
                // Clean up price (remove currency symbols, commas, etc.)
                price = price.replace(/[^0-9]/g, '');
              }
            }
            
            // If price is still empty, try a more aggressive approach
            if (!price) {
              // Look for elements containing price patterns
              const allElements = item.querySelectorAll('*');
              for (const el of allElements) {
                const text = el.textContent.trim();
                // Look for text that matches price pattern (e.g., "12,345원", "18,900원", "949,000원", "1,294,720원")
                if (text.match(/[0-9,]+원/) || text.match(/\d{1,3}(,\d{3})+/) || text.match(/\d+원/)) {
                  price = text.replace(/[^0-9]/g, '');
                  break;
                }
              }
            }
            
            // If still no price, look for percentage discounts which often appear near prices
            if (!price) {
              const discountElements = item.querySelectorAll('.instant-discount-rate, [class*="discount"], [class*="sale"]');
              for (const el of discountElements) {
                if (el.textContent.includes('%')) {
                  // Check nearby siblings for price
                  let sibling = el.nextElementSibling;
                  while (sibling && !price) {
                    const text = sibling.textContent.trim();
                    if (text.match(/[0-9,]+원/) || text.match(/\d{1,3}(,\d{3})+/) || text.match(/\d+원/)) {
                      price = text.replace(/[^0-9]/g, '');
                      break;
                    }
                    sibling = sibling.nextElementSibling;
                  }
                  
                  // If not found in next siblings, try previous siblings
                  if (!price) {
                    sibling = el.previousElementSibling;
                    while (sibling && !price) {
                      const text = sibling.textContent.trim();
                      if (text.match(/[0-9,]+원/) || text.match(/\d{1,3}(,\d{3})+/) || text.match(/\d+원/)) {
                        price = text.replace(/[^0-9]/g, '');
                        break;
                      }
                      sibling = sibling.previousElementSibling;
                    }
                  }
                  
                  // If still not found, look at parent's siblings
                  if (!price && el.parentElement) {
                    let parentSibling = el.parentElement.nextElementSibling;
                    while (parentSibling && !price) {
                      const text = parentSibling.textContent.trim();
                      if (text.match(/[0-9,]+원/) || text.match(/\d{1,3}(,\d{3})+/) || text.match(/\d+원/)) {
                        price = text.replace(/[^0-9]/g, '');
                        break;
                      }
                      parentSibling = parentSibling.nextElementSibling;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error extracting price:', e);
          }

          // Extract rating
          let rating = '';
          let ratingTotalCount = '';
          try {
            // Look for rating elements
            const ratingElement = item.querySelector('.rating, .product-rating, .star-rating, .rating-star, [class*="rating"], [class*="stars"]');
            if (ratingElement) {
              // Try to get numeric rating value
              const ratingText = ratingElement.textContent.trim();
              const ratingMatch = ratingText.match(/([0-9]\.[0-9]|[0-5])/); // Match patterns like 4.5 or just 4
              if (ratingMatch && ratingMatch[1]) {
                rating = ratingMatch[1];
              }
              
              // If no match in text, try to get from style width (common for star ratings)
              if (!rating && ratingElement.style && ratingElement.style.width) {
                const widthMatch = ratingElement.style.width.match(/([0-9]+)%/);
                if (widthMatch && widthMatch[1]) {
                  // Convert percentage to rating out of 5
                  const percentage = parseInt(widthMatch[1]);
                  rating = (percentage / 20).toFixed(1); // 100% = 5 stars
                }
              }
              
              // If still no rating, check for aria-label which often contains the rating
              if (!rating && ratingElement.getAttribute('aria-label')) {
                const ariaLabel = ratingElement.getAttribute('aria-label');
                const ariaMatch = ariaLabel.match(/([0-9]\.[0-9]|[0-5])/);
                if (ariaMatch && ariaMatch[1]) {
                  rating = ariaMatch[1];
                }
              }
            }
            
            // Look for rating count elements
            const ratingCountElement = item.querySelector('.rating-total-count, .review-count, [class*="review"], [class*="rating-count"], .count');
            if (ratingCountElement) {
              const countText = ratingCountElement.textContent.trim();
              // Extract numbers from the text (e.g., "(123)", "123 reviews", etc.)
              const countMatch = countText.match(/([0-9,]+)/);
              if (countMatch && countMatch[1]) {
                ratingTotalCount = countMatch[1].replace(/,/g, '');
              }
            }
          } catch (e) {
            console.error('Error extracting rating info:', e);
          }

          // Only add if we have at least a title and URL
          if (title && productUrl) {
            products.push({
              title,
              imageUrl,
              productUrl,
              productId,
              price,
              rating,
              ratingTotalCount
            });
          }
        } catch (e) {
          console.error('Error extracting product:', e);
        }
      });
    }
  } catch (error) {
    console.error('Error extracting products:', error);
  }
  
  return products;
}

// Automatically detect if we're on a product listing page and notify the extension
(function() {
  // Check if this looks like a product listing page
  const isProductListingPage = 
    document.querySelectorAll('li.search-product, ul.productList li, .baby-product').length > 0;
  
  if (isProductListingPage) {
    chrome.runtime.sendMessage({
      action: "pageIsProductListing",
      url: window.location.href
    });
  }
})();
