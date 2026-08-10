# Example legal documents

**These are examples, not legal advice, and not templates to publish unchanged.**

TippKeks ships no Impressum and no privacy policy. That is deliberate: such a
text names a concrete hosting provider, a concrete mail provider and a concrete
supervisory authority. Shipped with the app, it would hand every self-hoster a
document making claims that are false for them — and a false privacy policy is
worse than none.

The files here are the documents of the reference deployment (tippkeks.de), kept
so you start from something rather than a blank page. Whether a given text is
complete and correct for your deployment is a question only you, or a lawyer,
can answer.

## Using them

1. Copy the files to a directory on the machine that runs the app, dropping the
   language suffix:

   ```bash
   mkdir -p /srv/tippkeks/legal
   cp examples/legal/imprint.de.html  /srv/tippkeks/legal/imprint.html
   cp examples/legal/privacy.de.html  /srv/tippkeks/legal/privacy.html
   ```

2. Edit them. At minimum: the operator address, the hosting provider, the mail
   provider and the supervisory authority responsible for you. Delete the
   comment block at the top of each file.

3. Point `LEGAL_DIR` at the directory and make it readable inside the container:

   ```
   LEGAL_DIR=/srv/tippkeks/legal
   ```

Without `LEGAL_DIR`, or with a file missing, `/imprint` and `/privacy` render a
notice that the document is not configured. The app never invents one.

## Format

Plain HTML fragments — no `<html>`, `<head>` or `<body>`. Use `<h2>` for section
headings, plus `<p>`, `<ul>`, `<address>` and `<a>`; the app styles them to match
the rest of the UI. Content is inserted as-is, so it is your markup that is
served: treat these files as part of your deployment configuration and do not
let anyone edit them who could not already change the site.

Changes take effect on the next request — no restart, no rebuild.
