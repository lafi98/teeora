#!/usr/bin/env python3
"""
Verify the connection to a Shopify store using the Admin API.

Reads SHOP_DOMAIN, ADMIN_TOKEN and API_VERSION from a local .env file
(or the environment) and prints:
  1. Shop information
  2. The access token's granted API scopes (permissions)
  3. A list of products

Uses only the Python standard library — no pip installs required.
"""

import json
import os
import sys
import urllib.request
import urllib.error


def load_dotenv(path=".env"):
    """Minimal .env loader (KEY=VALUE lines)."""
    if not os.path.exists(path):
        return
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def api_get(domain, token, version, endpoint):
    """GET a REST Admin API endpoint and return parsed JSON."""
    url = f"https://{domain}/admin/api/{version}/{endpoint}"
    req = urllib.request.Request(url)
    req.add_header("X-Shopify-Access-Token", token)
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def main():
    load_dotenv()
    domain = os.environ.get("SHOP_DOMAIN", "").strip()
    token = os.environ.get("ADMIN_TOKEN", "").strip()
    version = os.environ.get("API_VERSION", "2024-10").strip()

    if not domain or not token or token.startswith("shpat_xxxx"):
        sys.exit("ERROR: Set SHOP_DOMAIN and a real ADMIN_TOKEN in your .env file first.")

    print(f"Connecting to {domain} (API {version}) ...\n")

    try:
        # 1. Shop information
        shop = api_get(domain, token, version, "shop.json")["shop"]
        print("=== SHOP INFORMATION ===")
        for field in ("name", "email", "domain", "myshopify_domain",
                      "plan_name", "currency", "country_name", "timezone"):
            print(f"  {field:20}: {shop.get(field)}")
        print()

        # 2. Access scopes (permissions)
        scopes = api_get(domain, token, version,
                         "oauth/access_scopes.json").get("access_scopes", [])
        print("=== API PERMISSIONS (SCOPES) ===")
        for s in scopes:
            print(f"  - {s.get('handle')}")
        print()

        # 3. Products
        products = api_get(domain, token, version,
                           "products.json?limit=20").get("products", [])
        print(f"=== PRODUCTS (showing {len(products)}) ===")
        if not products:
            print("  (no products found)")
        for p in products:
            status = p.get("status", "?")
            print(f"  [{p.get('id')}] {p.get('title')}  ({status})")
        print("\nConnection verified successfully. ✅")

    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"HTTP {e.code} {e.reason}\n{body}\n\n"
                 "401/403 -> token wrong or missing scopes.\n"
                 "404 -> check SHOP_DOMAIN or API_VERSION.")
    except urllib.error.URLError as e:
        sys.exit(f"Network error: {e.reason}")


if __name__ == "__main__":
    main()
