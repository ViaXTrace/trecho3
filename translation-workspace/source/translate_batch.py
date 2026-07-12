#!/usr/bin/env python3
"""
Translation script for Subarashiki Hibi fan patch - BATCH 4
Rules:
- No accents or cedillas (cp932 encoding limitation)
- Don't translate: NAME blocks (proper nouns), technical identifiers in OTHER blocks
- TEXT blocks: translate to colloquial Brazilian Portuguese
- Explicit sexual content: keep in English
- Preserve all tags, structure, comments
"""

import re

# Translation dictionary for common phrases/words
# Format: english_pattern -> portuguese_translation (no accents)
TRANSLATIONS = {}

def is_technical_id(text):
    """Check if text is a technical identifier (filename, sound ID, etc.)"""
    text = text.strip()
    if not text:
        return True
    # Patterns: no spaces, looks like a code
    patterns = [
        r'^\w+\.\w{2,4}$',  # filename with extension
        r'^[a-z]{2,5}\d{6}$',  # voice ID like taku_000433 -> actually underscore
        r'^[a-z_]+\d{3,}$',  # IDs with underscores and numbers
        r'^bgm\d+$',  # bgm001
        r'^se\d+$',   # se246
        r'^[a-z0-9_]+$',  # all lowercase alphanum/underscore (likely technical)
        r'^ev\d+\w*$',  # event IDs
        r'^bg\d+\w*$',  # background IDs
        r'^map\d+$',   # map IDs
        r'^white$|^black$|^Black$',  # color names used as IDs
    ]
    for p in patterns:
        if re.match(p, text):
            return True
    # If it has spaces and looks like English prose, probably translatable
    if ' ' in text and len(text.split()) > 2:
        return False
    return False


def translate_text(en_text):
    """
    Translate English text to Brazilian Portuguese (no accents).
    Returns translated text or original if should not be translated.
    """
    # Preserve empty lines
    if not en_text.strip():
        return en_text
    
    # Use lookup table
    return TRANSLATIONS.get(en_text, en_text)


def process_file(filename):
    """Process a single translation file."""
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    result = []
    
    i = 0
    current_block_type = None  # 'NAME', 'TEXT', 'OTHER'
    en_line = None
    
    while i < len(lines):
        line = lines[i]
        
        # Detect block type comments
        stripped = line.strip()
        if stripped.startswith('//NAME'):
            current_block_type = 'NAME'
        elif stripped.startswith('//TEXT') or stripped.startswith('///'):
            current_block_type = 'TEXT'
        elif stripped.startswith('//OTHER'):
            current_block_type = 'OTHER'
        
        # Detect en line
        if line.startswith('<en'):
            en_line = line
            # Extract tag and content
            match = re.match(r'(<en([A-Z])(\d+))>(.*)', line, re.DOTALL)
            if match:
                en_tag = match.group(1)
                type_char = match.group(2)  # N, T, or Z
                num = match.group(3)
                en_content = match.group(4)
                result.append(line)
                i += 1
                continue
        
        # Detect pt line (to be translated)
        if line.startswith('<pt'):
            match = re.match(r'(<pt([A-Z])(\d+))>(.*)', line, re.DOTALL)
            if match:
                pt_tag_full = match.group(1)
                type_char = match.group(2)  # N, T, or Z
                num = match.group(3)
                pt_content = match.group(4)
                
                # Also get the corresponding en content
                en_match = None
                if en_line:
                    en_match = re.match(r'(<en[A-Z]\d+)>(.*)', en_line, re.DOTALL)
                
                en_content = en_match.group(2) if en_match else pt_content
                
                # Decide what to put in pt
                if type_char == 'N':
                    # NAME: keep as is (proper nouns)
                    new_pt = line
                elif type_char == 'Z':
                    # OTHER: keep technical IDs, translate prose
                    if is_technical_id(en_content):
                        new_pt = line  # keep as is
                    else:
                        # Could be translatable text, but most are technical
                        new_pt = line  # keep as is for safety
                elif type_char == 'T':
                    # TEXT: translate
                    translated = translate_text(en_content)
                    new_pt = f'{pt_tag_full}>{translated}'
                else:
                    new_pt = line
                
                result.append(new_pt)
                en_line = None
                i += 1
                continue
        
        result.append(line)
        i += 1
    
    return '\n'.join(result)


if __name__ == '__main__':
    # Test
    print("Translation script loaded")
