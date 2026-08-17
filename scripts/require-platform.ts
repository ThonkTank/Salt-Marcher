const expected = process.argv[2]

if (!expected) throw new Error('Usage: require-platform <process.platform>')
if (process.platform !== expected)
  throw new Error(
    `This check requires ${expected}; current platform is ${process.platform}.`
  )
