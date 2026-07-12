#!/usr/bin/env python3
"""
Create the TEEORA "Sables" catalog products in Shopify via the Admin API.

Reads products.json and creates each as an ACTIVE product with title,
description (body_html), price, product type, vendor, tags, and SEO
title/meta description. Uses only the Python standard library.

Usage:
  python3 create_products.py            # create all products
  python3 create_products.py --dry-run  # show what would be created

Requires SHOP_DOMAIN, ADMIN_TOKEN (write_products) and API_VERSION in .env.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

VENDOR = "TEEORA"


def load_dotenv(path=".env"):
    if not os.path.exists(path):
        return
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


def api(method, domain, token, version, endpoint, payload=None):
    url = f"https://{domain}/admin/api/{version}/{endpoint}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-Shopify-Access-Token", token)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode()), resp.getcode()


def existing_titles(domain, token, version):
    """Return a set of existing product titles (to avoid duplicates on re-run)."""
    titles = set()
    try:
        data, _ = api("GET", domain, token, version, "products.json?limit=250&fields=title")
        for p in data.get("products", []):
            titles.add(p.get("title"))
    except Exception:
        pass
    return titles


def main():
    load_dotenv()
    dry = "--dry-run" in sys.argv
    domain = os.environ.get("SHOP_DOMAIN", "").strip()
    token = os.environ.get("ADMIN_TOKEN", "").strip()
    version = os.environ.get("API_VERSION", "2024-10").strip()

    if not domain or not token or token.startswith("shpat_xxxx"):
        sys.exit("ERROR: Set SHOP_DOMAIN and a real ADMIN_TOKEN (write_products) in .env first.")

    with open("products.json") as fh:
        products = json.load(fh)

    print(f"{'DRY RUN — ' if dry else ''}Creating {len(products)} products on {domain} (API {version})\n")

    have = set() if dry else existing_titles(domain, token, version)
    created, skipped, failed = 0, 0, 0

    for i, p in enumerate(products, 1):
        title = p["title"]
        if title in have:
            print(f"[{i:02d}] SKIP  (already exists) — {title}")
            skipped += 1
            continue

        payload = {
            "product": {
                "title": title,
                "body_html": p["body_html"],
                "vendor": VENDOR,
                "product_type": p["product_type"],
                "tags": p["tags"],
                "status": "active",
                "variants": [{"price": p["price"]}],
                "metafields_global_title_tag": p["seo_title"],
                "metafields_global_description_tag": p["seo_description"],
            }
        }

        if dry:
            print(f"[{i:02d}] WOULD CREATE — {title}  (${p['price']}, {p['product_type']})")
            created += 1
            continue

        try:
            data, code = api("POST", domain, token, version, "products.json", payload)
            pid = data.get("product", {}).get("id")
            print(f"[{i:02d}] OK    — {title}  → id {pid}  (active, ${p['price']})")
            created += 1
            time.sleep(0.6)  # stay well under API rate limits
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"[{i:02d}] FAIL  — {title}  → HTTP {e.code}: {body}")
            failed += 1
        except urllib.error.URLError as e:
            print(f"[{i:02d}] FAIL  — {title}  → network: {e.reason}")
            failed += 1

    print(f"\nDone. created/queued: {created}, skipped: {skipped}, failed: {failed}")
    if not dry and failed == 0 and created > 0:
        print("All products are Active and will appear on your Catalog page automatically.")


if __name__ == "__main__":
    main()
