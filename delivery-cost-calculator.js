const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Configuration data
const productCenters = {
  'A': 'C1', 'B': 'C1', 'C': 'C1',
  'D': 'C2', 'E': 'C2', 'F': 'C2',
  'G': 'C3', 'H': 'C3', 'I': 'C3'
};

const productWeights = {
  'A': 3, 'B': 2, 'C': 8,
  'D': 12, 'E': 25, 'F': 15,
  'G': 0.5, 'H': 1, 'I': 2
};

const distances = {
  'C1-L1': 3,
  'C2-L1': 2.5,
  'C3-L1': 2,
  'C1-C2': 4,
  'C1-C3': 5,
  'C2-C3': 3
};

// Helper function to get distance between two locations
function getDistance(loc1, loc2) {
  if (loc1 === loc2) return 0;
  
  // Try direct lookup
  const key1 = `${loc1}-${loc2}`;
  if (distances[key1] !== undefined) return distances[key1];
  
  // Try reverse lookup
  const key2 = `${loc2}-${loc1}`;
  if (distances[key2] !== undefined) return distances[key2];
  
  return 0;
}

// Calculate cost for a given weight and distance
function calculateCost(weight, distance) {
  if (weight === 0 || distance === 0) return 0;
  
  // Base cost for any distance is 10 units per distance
  const baseCost = 10 * distance;
  
  // Additional cost for weight over 5kg
  if (weight > 5) {
    const additionalWeight = weight - 5;
    const additionalBlocks = Math.ceil(additionalWeight / 5);
    const additionalCost = additionalBlocks * 8 * distance;
    return baseCost + additionalCost;
  } else {
    return baseCost;
  }
}

// Calculate the cost of a specific route
function calculateRouteCost(route, centerWeights) {
  let totalCost = 0;
  let currentWeight = 0;
  let currentLocation = route[0];
  
  // Initially pick up from first center
  currentWeight += centerWeights[currentLocation] || 0;
  
  // Process each stop in the route
  for (let i = 1; i < route.length; i++) {
    const nextLocation = route[i];
    const distance = getDistance(currentLocation, nextLocation);
    
    // Calculate cost based on current weight and distance
    const segmentCost = calculateCost(currentWeight, distance);
    totalCost += segmentCost;
    
    // Update location
    currentLocation = nextLocation;
    
    // If we're at L1, drop off all products
    if (currentLocation === 'L1') {
      currentWeight = 0;
    } 
    // If we're at a center, pick up products
    else {
      currentWeight += centerWeights[currentLocation] || 0;
    }
  }
  
  return Math.round(totalCost);
}

// Generate all possible routes for a given set of centers
function generateAllPossibleRoutes(centers) {
  const allRoutes = [];
  
  // Function to generate all possible arrangements of centers with L1 insertions
  function generateRoutes(remainingCenters, currentRoute, currentLocation) {
    // If we've visited all centers, add final L1 if needed and add to routes
    if (remainingCenters.length === 0) {
      const finalRoute = [...currentRoute];
      if (currentLocation !== 'L1') {
        finalRoute.push('L1');
      }
      allRoutes.push(finalRoute);
      return;
    }
    
    // Try each remaining center as the next stop
    for (let i = 0; i < remainingCenters.length; i++) {
      const nextCenter = remainingCenters[i];
      const newRemaining = [...remainingCenters.slice(0, i), ...remainingCenters.slice(i + 1)];
      
      // Option 1: Go directly to the next center
      generateRoutes(newRemaining, [...currentRoute, nextCenter], nextCenter);
      
      // Option 2: Go to L1 first, then to the next center
      if (currentLocation !== 'L1') {
        generateRoutes(newRemaining, [...currentRoute, 'L1', nextCenter], nextCenter);
      }
    }
  }
  
  // Try each center as starting point
  for (let i = 0; i < centers.length; i++) {
    const startCenter = centers[i];
    const remainingCenters = [...centers.slice(0, i), ...centers.slice(i + 1)];
    
    // Start from this center
    generateRoutes(remainingCenters, [startCenter], startCenter);
  }
  
  return allRoutes;
}

// Main function to calculate minimum delivery cost
function findMinimumCost(order) {
  // Calculate weight from each center
  const centerWeights = { 'C1': 0, 'C2': 0, 'C3': 0 };
  const requiredCenters = new Set();
  
  // Calculate weights and identify required centers
  for (const [product, quantity] of Object.entries(order)) {
    if (quantity > 0 && productCenters[product]) {
      const center = productCenters[product];
      centerWeights[center] += productWeights[product] * quantity;
      requiredCenters.add(center);
    }
  }
  
  // If no products are ordered, return 0
  if (requiredCenters.size === 0) return { minimumCost: 0, bestRoute: [] };
  
  const centers = Array.from(requiredCenters);
  
  // For single center, direct route is optimal
  if (centers.length === 1) {
    const center = centers[0];
    const cost = calculateCost(centerWeights[center], getDistance(center, 'L1'));
    return {
      minimumCost: Math.round(cost),
      bestRoute: [center, 'L1']
    };
  }
  
  // Generate all possible routes
  const allRoutes = generateAllPossibleRoutes(centers);
  
  // Find the minimum cost route
  let minCost = Infinity;
  let bestRoute = null;
  
  for (const route of allRoutes) {
    const cost = calculateRouteCost(route, centerWeights);
    if (cost < minCost) {
      minCost = cost;
      bestRoute = route;
    }
  }
  
  return {
    minimumCost: minCost,
    bestRoute: bestRoute
  };
}

// API endpoint
app.post('/api/delivery-cost', (req, res) => {
  try {
    const order = req.body;
    const result = findMinimumCost(order);
    
    res.json({
      minimumCost: result.minimumCost,
      bestRoute: result.bestRoute
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;