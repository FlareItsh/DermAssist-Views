fetch('http://localhost:8000/api/records', {
  headers: {
    'Authorization': 'Bearer 8|sgXu889ZpTT4Iw2aUMGHPaz1z4AXp6XCQ1BLDTZwa3f0eac1',
    'Accept': 'application/json'
  }
}).then(res => res.json()).then(console.log).catch(console.error);
