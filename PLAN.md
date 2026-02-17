# Ham Sandwich

This is a collection of web-based modems for Ham radio.  The modems make use of a user's speakers/mic to encode/decode over a number of common digital modes.


## Details

- use [Oat](https://oat.ink/components/) for building the interface
- write tests to validate encode→decode round-trip works
- desired modes and configs
  - hellschreiber
    - ability to change font (whatever default is easiest is OK)
  - others
- common options for each mode
- simultaneous encode/decode ability
- sending
    - editable input text box for input text
    - graphics area that shows the hellschreiber message being sent with some sort of indicator
- non-editable output text box for decoding
  
## Goals for Later
- modular GUI
  - shared components betwee pages (e.g. sound card configuration)
- send waterfall
- receive waterfall