#!/usr/bin/python3

"""
    A simple file for the configuration and generation
    of the C++ portion of this project.
"""

import os, sys

class MakefileBuilder:
    def __init__(self, programArgs = []):
        self.fileName = "unknown"

        if (len(programArgs) > 0):
            self.fileName = programArgs[0];

        # Were we given arguments?
        if (len(programArgs) > 1):
            # Handle these arguments.
            self.handleArgs(programArgs);
        
        

    def printHelp(self):
        print("Usage:")
        print("  %s [-h|--help]" % self.fileName)

    def handleArgs(self, args):
        for arg in args:
            if arg == "-h" or arg == "--help":
                self.printHelp();
                break;
            

if __name__ == "__main__":
    MakefileBuilder(sys.argv);