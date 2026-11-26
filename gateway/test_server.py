import unittest
from server import dispatch, load, valid_rows

class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.data = load()

    def test_health(self):
        status, result = dispatch(self.data, "/health", {})
        self.assertEqual(status, 200)
        self.assertIn("cinema", result["providers"])

    def test_search_episode_stream(self):
        status, rows = dispatch(self.data, "/search", {"provider": "cinema", "q": "Sol Levante"})
        self.assertEqual(status, 200)
        self.assertEqual(rows[0]["id"], "sol-levante")
        status, eps = dispatch(self.data, "/content", {"provider": "cinema", "mediaId": rows[0]["id"]})
        self.assertEqual(status, 200)
        status, result = dispatch(self.data, "/stream", {"provider": "cinema", "unitId": eps[0]["id"], "language": "raw"})
        self.assertEqual(status, 200)
        self.assertTrue(result["streams"][0]["sourceUrl"].startswith("https://"))
        self.assertEqual(dispatch(self.data, "/stream", {"provider": "cinema", "unitId": eps[0]["id"], "language": "dub"})[1]["streams"], [])

    def test_unknown_and_invalid(self):
        self.assertEqual(dispatch(self.data, "/search", {"provider": "unknown", "q": "x"})[0], 404)
        self.assertEqual(dispatch(self.data, "/stream", {"provider": "cinema", "unitId": "unknown"})[0], 404)
        self.assertEqual(dispatch(self.data, "/search", {"provider": "cinema", "q": ""})[0], 400)
        self.assertEqual(valid_rows([{"id": "x", "title": "x", "audience": "adult"}]), [])

if __name__ == "__main__":
    unittest.main()
