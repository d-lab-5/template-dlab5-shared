# CLAUDE.md: template-dlab5-shared

The Copier template for a D-LAB-5 product's public docs repository. Read
README.md. The first product made from it is `d-lab-5/mediathek-digitalhome-shared`,
where the scripts came from.

- `template/` is what a product gets. A file ending in `.jinja` is rendered
  with the answers; everything else is copied as it is.
- The scripts read `shared.json` at run time. They have no Jinja in them, so
  they are the same file in every product, and an update stays a clean diff.
  Keep it that way: product-specific text goes in `shared.json`'s `texts`,
  with a default in `scripts/config.mjs`.
- `_skip_if_exists` in `copier.yml` is the line between template and product.
  A file a product edits must be on it.
- Run `./test.sh` after any change. It is what CI runs.
- This repository is public, and so is every product: no real names, account
  ids or local paths, even in tests. Use example.org.
