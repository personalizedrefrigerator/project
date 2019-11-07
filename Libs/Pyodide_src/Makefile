
all: pyodide

pyodide:
	if [ -d pyodide ]; then rm -rf pyodide; fi
	git clone https://github.com/iodide-project/pyodide.git
	bash ./patch.sh
	cd pyodide
	make
	bash ./connectPyodide.sh

clean:
	rm -rf pyodide
