import { queryArchiveMusic } from './src/services/musicDiscoveryService.ts';

(async () => {
  try {
    const results = await queryArchiveMusic('test');
    console.log('Archive results count:', results.length);
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
})();
