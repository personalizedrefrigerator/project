#!/bin/python3

from urllib.request import urlopen
from urllib.parse import urlparse
from html.parser import HTMLParser
from os.path import basename

import sys

class IndexFileParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        
    def handle_starttag(self, tag, attributes):
        if tag == "a":
            for attr in attributes:
                name, value = attr

                if name == "href":
                    self.links.append(value)
    def getLinks(self):
        return self.links

def saveFile(link):
    print ("[*] Reading %s..." % link)
    request = urlopen(link)

    content = request.read()#.decode("utf-16", errors="ignore")

    writeTo = basename(urlparse(link).path)
    print ("[*] Writing to %s." % writeTo)
    
    out = open(writeTo, "wb")

    out.write(content)

    out.close()
    request.close()
    
    print("[+] Handled link %s." % link)

def main(requestURL):
    print("[*] Connecting to %s...")
    
    request = urlopen(requestURL)

    # Get content.
    content = request.read().decode("utf-8")

    print("[+] Got content %s..." % content[0:50])

    request.close()

    # Parse content.
    parser = IndexFileParser()
    parser.feed(content)

    parsedURL = urlparse(requestURL)

    baseURL = parsedURL.scheme + "://" + parsedURL.netloc + "/"

    # Request each url.
    for link in parser.getLinks():
        if link.startswith("http://"):
            print("[-] Refusing to redirect to %s." % link)
        else:
            saveFile(baseURL + urlparse(link).path)

if __name__ == "__main__":
    if len(sys.argv) >= 2:
        main(sys.argv[1])
    else:
        main("http://127.0.0.1:5000/")
