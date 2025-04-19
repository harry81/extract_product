document.addEventListener('DOMContentLoaded', function() {
  // Add keyboard shortcut listener
  document.addEventListener('keydown', function(event) {
    // Check for Alt+C keyboard shortcut
    if (event.altKey && event.code === 'KeyC') {
      // Simulate click on the extract button
      document.getElementById('crawlButton').click();
      // Visual feedback for shortcut usage
      document.getElementById('crawlButton').classList.add('button-flash');
      setTimeout(() => {
        document.getElementById('crawlButton').classList.remove('button-flash');
      }, 300);
    }
  });
  const extractButton = document.getElementById('crawlButton'); // ID remains the same for compatibility
  const exportCSVButton = document.getElementById('exportCSV');
  const exportJSONButton = document.getElementById('exportJSON');
  const clearDataButton = document.getElementById('clearData');
  const previewButton = document.getElementById('previewButton');
  const statusDiv = document.getElementById('status');
  const productCountSpan = document.getElementById('productCount');
  const exportSection = document.getElementById('exportSection');
  const previewSection = document.getElementById('previewSection');
  const previewContent = document.getElementById('previewContent');
  const prevPageButton = document.getElementById('prevPage');
  const nextPageButton = document.getElementById('nextPage');
  const pageInfoSpan = document.getElementById('pageInfo');

  // Preview pagination variables
  let currentPage = 1;
  let itemsPerPage = 10;
  let totalPages = 1;

  // Load any existing data and update UI
  updateProductCount();

  // Extract button click handler
  extractButton.addEventListener('click', function() {
    // Get the active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];

      // Check if the current page is a supported product page
      if (!activeTab.url.includes('coupang.com') && !activeTab.url.includes('product')) {
        showStatus('제품 목록 페이지에서만 사용할 수 있습니다.', 'error');
        return;
      }

      // Show status
      showStatus('제품 정보를 추출 중입니다...', '');

      // Execute content script to extract data from the page
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        function: extractProducts
      }, (results) => {
        if (chrome.runtime.lastError) {
          showStatus('오류가 발생했습니다: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        const products = results[0].result;

        if (products.length === 0) {
          showStatus('제품을 찾을 수 없습니다. 제품 목록 페이지인지 확인해주세요.', 'error');
          return;
        }

        // Save products to storage
        chrome.storage.local.get(['products'], function(result) {
          let existingProducts = result.products || [];

          // Add new products
          existingProducts = existingProducts.concat(products);

          // Save back to storage
          chrome.storage.local.set({products: existingProducts}, function() {
            showStatus(`${products.length}개의 제품 정보가 추출되었습니다.`, 'success');
            updateProductCount();
          });
        });
      });
    });
  });

  // Export to CSV
  exportCSVButton.addEventListener('click', function() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];

      if (products.length === 0) {
        showStatus('내보낼 제품 정보가 없습니다.', 'error');
        return;
      }

      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += '제품 ID,제목,가격,이미지 URL,제품 URL\n';

      products.forEach(function(product) {
        const row = [
          `"${product.productId || ''}"`,
          `"${product.title.replace(/"/g, '""')}"`,
          `"${product.price || ''}"`,
          `"${product.imageUrl}"`,
          `"${product.productUrl}"`
        ].join(',');
        csvContent += row + '\n';
      });

      // Create download link and trigger download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'products.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });

  // Export to JSON
  exportJSONButton.addEventListener('click', function() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];

      if (products.length === 0) {
        showStatus('내보낼 제품 정보가 없습니다.', 'error');
        return;
      }

      // Create JSON content
      const jsonContent = 'data:text/json;charset=utf-8,' +
                          encodeURIComponent(JSON.stringify(products, null, 2));

      // Create download link and trigger download
      const link = document.createElement('a');
      link.setAttribute('href', jsonContent);
      link.setAttribute('download', 'products.json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });

  // Preview button
  previewButton.addEventListener('click', function() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];

      if (products.length === 0) {
        showStatus('미리볼 제품 정보가 없습니다.', 'error');
        return;
      }

      // Show preview section
      previewSection.style.display = 'flex';

      // Calculate total pages
      totalPages = Math.ceil(products.length / itemsPerPage);
      currentPage = 1;

      // Update page info
      updatePageInfo();

      // Render first page
      renderPreviewPage(products, currentPage);
    });
  });

  // Previous page button
  prevPageButton.addEventListener('click', function() {
    if (currentPage > 1) {
      currentPage--;
      chrome.storage.local.get(['products'], function(result) {
        const products = result.products || [];
        updatePageInfo();
        renderPreviewPage(products, currentPage);
      });
    }
  });

  // Next page button
  nextPageButton.addEventListener('click', function() {
    if (currentPage < totalPages) {
      currentPage++;
      chrome.storage.local.get(['products'], function(result) {
        const products = result.products || [];
        updatePageInfo();
        renderPreviewPage(products, currentPage);
      });
    }
  });

  // Clear data
  clearDataButton.addEventListener('click', function() {
    chrome.storage.local.remove(['products'], function() {
      showStatus('모든 제품 정보가 삭제되었습니다.', 'success');
      updateProductCount();
      previewSection.style.display = 'none';
    });
  });

  // Helper function to show status messages
  function showStatus(message, type) {
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    else if (type === 'error') icon = 'error';

    statusDiv.innerHTML = `
      <span class="material-icons">${icon}</span>
      ${message}
    `;
    statusDiv.className = type || 'info';
  }

  // Helper function to update product count
  function updateProductCount() {
    chrome.storage.local.get(['products'], function(result) {
      const products = result.products || [];
      productCountSpan.textContent = products.length;

      if (products.length > 0) {
        exportSection.style.display = 'flex';
      } else {
        exportSection.style.display = 'none';
        previewSection.style.display = 'none';
      }
    });
  }

  // Helper function to render preview page
  function renderPreviewPage(products, page) {
    // Clear previous content
    previewContent.innerHTML = '';

    // Show empty state if no products
    if (products.length === 0) {
      previewContent.innerHTML = `
        <div class="empty-state">
          <span class="material-icons">inventory_2</span>
          <p>수집된 제품이 없습니다.<br>제품 정보 수집하기 버튼을 클릭하여 제품을 수집해주세요.</p>
        </div>
      `;
      return;
    }

    // Calculate start and end indices
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, products.length);

    // Render items for current page
    for (let i = startIndex; i < endIndex; i++) {
      const product = products[i];

      // Create preview item element
      const itemElement = document.createElement('div');
      itemElement.className = 'preview-item';

      // Create image container
      const imageContainer = document.createElement('div');
      imageContainer.className = 'preview-image';

      // Add image if available
      if (product.imageUrl) {
        const imgElement = document.createElement('img');
        imgElement.src = product.imageUrl;
        imgElement.alt = product.title || '제품 이미지';
        imgElement.onerror = function() {
          this.parentNode.innerHTML = '<span class="material-icons">image_not_supported</span>';
        };
        imageContainer.appendChild(imgElement);
      } else {
        const iconElement = document.createElement('span');
        iconElement.className = 'material-icons';
        iconElement.textContent = 'image_not_supported';
        imageContainer.appendChild(iconElement);
      }

      itemElement.appendChild(imageContainer);

      // Add details
      const detailsElement = document.createElement('div');
      detailsElement.className = 'preview-item-details';

      // Product ID with icon (First)
      if (product.productId) {
        const idElement = document.createElement('p');
        idElement.className = 'preview-info';
        idElement.innerHTML = `
          <span class="material-icons">tag</span>
          ID: ${product.productId}
        `;
        detailsElement.appendChild(idElement);
      }

      // Title (Second)
      const titleElement = document.createElement('p');
      titleElement.className = 'preview-title';
      titleElement.textContent = product.title || '제품명 없음';
      detailsElement.appendChild(titleElement);

      // Price with icon (Third)
      if (product.price) {
        const priceElement = document.createElement('p');
        priceElement.className = 'preview-info preview-price';

        // Format price with commas
        let formattedPrice = product.price;
        try {
          // Remove existing commas and then format
          const priceNum = formattedPrice.replace(/,/g, '');
          if (!isNaN(priceNum)) {
            formattedPrice = Number(priceNum).toLocaleString('ko-KR') + '원';
          }
        } catch (e) {
          // Keep original if parsing fails
          formattedPrice += '원';
        }

        priceElement.innerHTML = `
          <span class="material-icons">payments</span>
          ${formattedPrice}
        `;
        detailsElement.appendChild(priceElement);
      }

      // Image URL with icon (Fourth)
      if (product.imageUrl) {
        const imageUrlElement = document.createElement('p');
        imageUrlElement.className = 'preview-info';
        const displayImageUrl = product.imageUrl.length > 30 ?
          product.imageUrl.substring(0, 30) + '...' :
          product.imageUrl;

        imageUrlElement.innerHTML = `
          <span class="material-icons">image</span>
          이미지 URL: ${displayImageUrl}
        `;
        detailsElement.appendChild(imageUrlElement);
      }

      // Product URL with icon (Fifth)
      if (product.productUrl) {
        const urlElement = document.createElement('p');
        urlElement.className = 'preview-info';
        const displayUrl = product.productUrl.length > 30 ?
          product.productUrl.substring(0, 30) + '...' :
          product.productUrl;

        urlElement.innerHTML = `
          <span class="material-icons">link</span>
          제품 URL: ${displayUrl}
        `;
        detailsElement.appendChild(urlElement);
      }

      itemElement.appendChild(detailsElement);
      previewContent.appendChild(itemElement);
    }
  }

  // Helper function to update page info
  function updatePageInfo() {
    pageInfoSpan.textContent = `${currentPage}/${totalPages}`;

    // Update button states
    prevPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;
  }
});

// This function will be injected into the page
function extractProducts() {
  // Function to extract products from the page
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
              productUrl = 'https://www.coupang.com' + productUrl;
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
      console.error('Error extracting products:', error);
    }

    return products;
  }

  return extractProducts();
}
