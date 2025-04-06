// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'collect-products') {
    // Check if we're on a Coupang page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      // Only proceed if we're on a Coupang page
      if (activeTab.url.includes('coupang.com')) {
        // Execute the product collection script
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: collectProducts
        }, (results) => {
          if (chrome.runtime.lastError) {
            showNotification('오류가 발생했습니다: ' + chrome.runtime.lastError.message);
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const newProducts = results[0].result;
            
            if (newProducts.length === 0) {
              showNotification('제품을 찾을 수 없습니다.');
              return;
            }
            
            // Get existing products from storage
            chrome.storage.local.get(['products'], (result) => {
              let existingProducts = result.products || [];
              
              // Add new products
              existingProducts = existingProducts.concat(newProducts);
              
              // Remove duplicates by product ID
              const uniqueProducts = [];
              const seenIds = new Set();
              
              existingProducts.forEach(product => {
                if (product.productId && !seenIds.has(product.productId)) {
                  seenIds.add(product.productId);
                  uniqueProducts.push(product);
                } else if (!product.productId) {
                  // Keep products without IDs
                  uniqueProducts.push(product);
                }
              });
              
              // Save to storage
              chrome.storage.local.set({ products: uniqueProducts }, () => {
                showNotification(`${newProducts.length}개의 제품 정보를 수집했습니다.`);
                
                // Try to show visual effect using both methods for reliability
                console.log('Attempting to show visual effect...');
                
                // Method 1: Send message to content script
                chrome.tabs.sendMessage(activeTab.id, {
                  action: "showCompletionEffect",
                  productCount: newProducts.length
                }, response => {
                  console.log('Response from content script:', response);
                  
                  // If there's an error with the message approach, use direct script injection
                  if (chrome.runtime.lastError) {
                    console.log('Falling back to direct script injection method');
                    // Method 2: Direct script injection (more reliable fallback)
                    chrome.scripting.executeScript({
                      target: { tabId: activeTab.id },
                      function: (count) => {
                        console.log('Executing injected visual effect script with count:', count);
                        
                        // Create and inject the CSS for the animation
                        const style = document.createElement('style');
                        style.textContent = `
                          .collection-complete-overlay {
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
                          .collection-complete-container {
                            background-color: white;
                            border-radius: 12px;
                            padding: 30px 50px;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                            text-align: center;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            transform: scale(0.9);
                            animation: collection-complete-pop 0.5s forwards;
                          }
                          @keyframes collection-complete-pop {
                            0% { transform: scale(0.8); }
                            60% { transform: scale(1.05); }
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
                          .collection-complete-icon::after {
                            content: '';
                            width: 50px;
                            height: 25px;
                            border-left: 8px solid white;
                            border-bottom: 8px solid white;
                            transform: rotate(-45deg) translate(5px, -10px);
                          }
                          .collection-complete-title {
                            font-size: 26px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            color: #333;
                          }
                          .collection-complete-count {
                            font-size: 20px;
                            color: #666;
                          }
                        `;
                        document.head.appendChild(style);

                        // Create the overlay element
                        const overlay = document.createElement('div');
                        overlay.className = 'collection-complete-overlay';

                        // Create the container
                        const container = document.createElement('div');
                        container.className = 'collection-complete-container';

                        // Create the icon
                        const icon = document.createElement('div');
                        icon.className = 'collection-complete-icon';

                        // Create the title
                        const title = document.createElement('div');
                        title.className = 'collection-complete-title';
                        title.textContent = '수집 완료!';

                        // Create the count
                        const countText = document.createElement('div');
                        countText.className = 'collection-complete-count';
                        countText.textContent = `${count}개의 제품 정보를 수집했습니다.`;

                        // Assemble the elements
                        container.appendChild(icon);
                        container.appendChild(title);
                        container.appendChild(countText);
                        overlay.appendChild(container);
                        document.body.appendChild(overlay);

                        // Remove the overlay after animation completes
                        setTimeout(() => {
                          if (document.body.contains(overlay)) {
                            document.body.removeChild(overlay);
                          }
                          if (document.head.contains(style)) {
                            document.head.removeChild(style);
                          }
                        }, 3000);
                        
                        console.log('Visual effect displayed successfully');
                      },
                      args: [newProducts.length]
                    });
                  }
                });
              });
            });
          } else {
            showNotification('제품 정보를 가져오는데 실패했습니다.');
          }
        });
      } else {
        showNotification('쿠팡 웹사이트에서만 사용할 수 있습니다.');
      }
    });
  }
});

// Function to show Chrome notification
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: '쿠팡 제품 크롤러',
    message: message
  });
}

// Function to show visual effect when collection is complete
function showCollectionCompleteEffect(productCount) {
  // Create and inject the CSS for the animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes collection-complete-pulse {
      0% { opacity: 0; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.1); }
      100% { opacity: 0; transform: scale(1.5); }
    }

    .collection-complete-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.4);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: none;
      animation: collection-complete-fade 2s forwards;
    }

    @keyframes collection-complete-fade {
      0% { opacity: 0; }
      10% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }

    .collection-complete-container {
      background-color: white;
      border-radius: 12px;
      padding: 20px 40px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: 'Noto Sans KR', sans-serif, system-ui;
    }

    .collection-complete-icon {
      width: 80px;
      height: 80px;
      background-color: #4CAF50;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 16px;
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

    .collection-complete-title {
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #333;
    }

    .collection-complete-count {
      font-size: 18px;
      color: #666;
      margin-bottom: 16px;
    }
  `;
  document.head.appendChild(style);

  // Create the overlay element
  const overlay = document.createElement('div');
  overlay.className = 'collection-complete-overlay';

  // Create the container
  const container = document.createElement('div');
  container.className = 'collection-complete-container';

  // Create the icon
  const icon = document.createElement('div');
  icon.className = 'collection-complete-icon';

  // Create the title
  const title = document.createElement('div');
  title.className = 'collection-complete-title';
  title.textContent = '수집 완료!';

  // Create the count
  const count = document.createElement('div');
  count.className = 'collection-complete-count';
  count.textContent = `${productCount}개의 제품 정보를 수집했습니다.`;

  // Assemble the elements
  container.appendChild(icon);
  container.appendChild(title);
  container.appendChild(count);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Remove the overlay after animation completes
  setTimeout(() => {
    document.body.removeChild(overlay);
    document.head.removeChild(style);
  }, 2500);

  return true; // Return value for the executeScript function
}

// This function will be injected into the page
function collectProducts() {
  // Function to extract products from the page
  function extractProducts() {
    const products = [];
    
    try {
      // Look for product items in various Coupang listing formats
      const productItems = document.querySelectorAll('li.search-product, ul.productList li, .baby-product');
      
      if (productItems.length > 0) {
        productItems.forEach(item => {
          try {
            let title = '';
            let imageUrl = '';
            let productUrl = '';
            let productId = '';
            let price = '';
            
            // Extract title
            try {
              const titleElement = item.querySelector('.name, .product-name, .title');
              if (titleElement) {
                title = titleElement.textContent.trim();
              }
            } catch (e) {
              console.error('Error extracting title:', e);
            }
            
            // Extract image URL
            try {
              const imgElement = item.querySelector('img.search-product-wrap-img, img.product-image, img.product-img');
              if (imgElement) {
                imageUrl = imgElement.src;
              }
            } catch (e) {
              console.error('Error extracting image URL:', e);
            }
            
            // Extract product URL
            try {
              const linkElement = item.querySelector('a.search-product-link, a.product-link, a[href*="/products/"]');
              if (linkElement) {
                productUrl = linkElement.href;
                
                // Try to extract product ID from URL
                const urlMatch = productUrl.match(/\/products\/(\d+)/);
                if (urlMatch && urlMatch[1]) {
                  productId = urlMatch[1];
                }
              }
            } catch (e) {
              console.error('Error extracting product URL:', e);
            }
            
            // Extract product ID from element attributes if not found in URL
            try {
              if (!productId) {
                // Try to get from item's ID attribute first
                if (item.id && item.id.match(/\d+/)) {
                  productId = item.id.match(/\d+/)[0];
                }
                
                // Try data attributes
                if (!productId) {
                  const dataProductId = item.getAttribute('data-product-id') || 
                                       item.getAttribute('data-productid') || 
                                       item.getAttribute('data-item-id') ||
                                       item.getAttribute('data-itemid');
                  if (dataProductId) {
                    productId = dataProductId;
                  }
                }
                
                // Try from URL parameters
                if (!productId && productUrl) {
                  const itemIdMatch = productUrl.match(/itemId=(\d+)/);
                  if (itemIdMatch && itemIdMatch[1]) {
                    productId = itemIdMatch[1];
                  }
                }
              }
            } catch (e) {
              console.error('Error extracting product ID:', e);
            }
            
            // Extract price
            try {
              // First try to find the price in a dedicated price element
              const priceElement = item.querySelector('strong.price-value, .price, .product-price, .price-info strong');
              
              if (priceElement) {
                price = priceElement.textContent.trim();
                // Clean up price (remove currency symbols, commas, etc.)
                price = price.replace(/[^0-9]/g, '');
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

            // Only add if we have at least a title and URL
            if (title && productUrl) {
              products.push({
                title,
                imageUrl,
                productUrl,
                productId,
                price
              });
            }
          } catch (e) {
            console.error('Error extracting product:', e);
          }
        });
      }
    } catch (error) {
      console.error('Error crawling products:', error);
    }
    
    return products;
  }

  return extractProducts();
}
