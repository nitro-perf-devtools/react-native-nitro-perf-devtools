cmake_minimum_required(VERSION 3.13)
project(NitroPerf)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PACKAGE_NAME NitroPerf)
set(CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")

# Source files
add_library(${PACKAGE_NAME} SHARED
  ${CPP_DIR}/HybridPerfMonitor.cpp
  ${CPP_DIR}/FPSTracker.cpp
  ${CPP_DIR}/PlatformMetrics_Android.cpp
)

# Include directories
target_include_directories(${PACKAGE_NAME} PRIVATE
  ${CPP_DIR}
  "${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/shared/c++"
  "${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/c++"
)

# Link Android libraries
find_library(LOG_LIB log)
target_link_libraries(${PACKAGE_NAME}
  ${LOG_LIB}
  android
)

# Load nitrogen autolinking CMake
set(NITROGEN_CMAKE "${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/NitroPerf+autolinking.cmake")
if(EXISTS ${NITROGEN_CMAKE})
  include(${NITROGEN_CMAKE})
endif()
