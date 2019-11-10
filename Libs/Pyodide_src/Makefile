
all: pyodide

pyodide:
	if [ -d pyodide ]; then rm -rf pyodide; fi
	git clone https://github.com/iodide-project/pyodide.git
	bash ./patch.sh
	cd pyodide
	make
	bash ./connect_pyodide.sh

clean:
	rm -rf pyodide
	rm -rf ../Pyodide
