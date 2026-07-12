# General settings for BGI script tools (configured for EN -> PT-BR translation)

# Source language (the existing English fan-translation baked into these scripts)
slang = 'en'

# Destination languages
dlang = ['pt']

# Insertion language
ilang = 'pt'

# Dump file extension
dext = '.txt'

# Source encoding
senc = 'cp932'

# Dump file encoding
denc = 'utf-8'

# Insertion encoding (Shift-JIS based; cannot represent accented Latin chars,
# so PT-BR translations must be written WITHOUT diacritics)
ienc = 'cp932'

# Copy source line to destination lines (blank line if set to false)
dcopy = True
