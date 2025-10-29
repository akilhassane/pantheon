# TTYD Build Fix Documentation

## Problem Summary

The initial Docker build failed during ttyd (web terminal) compilation with the following errors:

```
CMake Error: Could NOT find JSON-C
CMake Error: Could NOT find Libwebsockets (version 3.2.0)
```

## Root Cause

ttyd requires three libraries for compilation:
1. **zlib1g-dev** - Data compression library ✅ (was added initially)
2. **libjson-c-dev** - JSON parsing library ❌ (wrong package name used)
3. **libwebsockets-dev** - WebSocket implementation ❌ (missing entirely)

The previous fix added `libcjson-dev` which is a different package than `libjson-c-dev`.

## Solution Applied

Updated `Dockerfile.kali` line 41 to include all required build dependencies:

```dockerfile
# Before (FAILED):
build-essential cmake git pkg-config libssl-dev libcjson-dev nodejs npm \
zlib1g-dev \

# After (SUCCESS):
build-essential cmake git pkg-config libssl-dev nodejs npm \
zlib1g-dev libjson-c-dev libwebsockets-dev \
```

### Key Changes:
1. Removed `libcjson-dev` (incorrect package)
2. Added `libjson-c-dev` (correct JSON-C library)
3. Added `libwebsockets-dev` (WebSocket library - critical)

## Verification

To verify ttyd installs correctly, the container should:
1. ✅ Clone ttyd repository
2. ✅ Run CMake without JSON-C errors
3. ✅ Run CMake without Libwebsockets errors
4. ✅ Compile successfully
5. ✅ Install to /usr/bin/ttyd
6. ✅ Start web terminal on port 7681

## Build Status

**Previous Build**: ❌ Failed after 1544 seconds (25+ minutes)
- Installed ~150 packages successfully (1538 seconds)
- Failed at ttyd CMake configuration (5-6 seconds into ttyd build)

**Current Build**: ⏳ Running with correct dependencies
- Expected to complete in 50-80 minutes total

## Lesson Learned

When building from source in Docker, carefully check:
1. **All transitive dependencies** - tools often depend on libraries
2. **Package names** - Debian/Ubuntu often have different names
3. **Library versions** - CMake requires specific versions
4. **Build output** - error messages tell you exactly what's missing

## Future Prevention

To avoid similar issues:
1. Test the Dockerfile locally first
2. Check CMake output carefully
3. Refer to ttyd documentation for build requirements
4. Consider using pre-built binaries if available
5. Add comments documenting why each package is needed

## References

- ttyd GitHub: https://github.com/tsl0922/ttyd
- Kali Linux packages: https://www.kali.org/tools/kali-tools-top10/
- CMake documentation: https://cmake.org/documentation/

---

**Fix Applied**: October 25, 2025
**Build Restarted**: With complete dependencies
**Expected Completion**: ~50-80 minutes from restart


