// Smoke tests for the Tier 2 bash interpreter additions: case, arrays, getopts,
// here-docs, set -e/-u/pipefail, trap, mktemp, shellcheck, tar, (( )), local.
import { Shell } from '../src/shell/shell'

const sh = new Shell()
sh.seed({ '/home/learner/data/a.txt': 'alpha\n', '/home/learner/data/b.txt': 'beta\n' })
let fails = 0
const t = (cmd: string, expect: string | RegExp) => {
  let out: string
  try { out = sh.run(cmd).output } catch (e) { out = 'THROW ' + (e as Error).message }
  const pass = typeof expect === 'string' ? out === expect : expect.test(out)
  if (!pass) { fails++; console.log(`FAIL ${JSON.stringify(cmd)}\n  got: ${JSON.stringify(out)}\n  want: ${expect}`) }
}
const script = (name: string, body: string) => sh.vfs.writeFile('/home/learner/' + name, body, { owner: 'learner', mode: 0o755 })

// case
t('x=stop; case $x in start) echo up ;; stop|halt) echo down ;; *) echo what ;; esac', 'down\n')
t('case "hello world" in hello*) echo yes ;; esac', 'yes\n')
t('case 7 in [0-9]) echo digit ;; *) echo other ;; esac', 'digit\n')
t('case zz in a) echo a ;; esac; echo rc=$?', 'rc=0\n')
script('c.sh', '#!/bin/bash\ncase "$1" in\n  -h|--help)\n    echo "usage: c.sh [-h] name"\n    ;;\n  "")\n    echo "no name"\n    ;;\n  *)\n    echo "hi $1"\n    ;;\nesac\n')
t('./c.sh --help', 'usage: c.sh [-h] name\n')
t('./c.sh', 'no name\n')
t('./c.sh bob', 'hi bob\n')
// arrays
t('fruits=(apple banana cherry); echo ${fruits[1]} ${#fruits[@]}', 'banana 3\n')
t('fruits+=(date); echo "${fruits[@]}"', 'apple banana cherry date\n')
t('echo ${fruits[-1]} ${!fruits[@]}', 'date 0 1 2 3\n')
t('for f in "${fruits[@]}"; do echo "- $f"; done | wc -l', '4\n')
t('fruits[0]=avocado; echo $fruits', 'avocado\n')
t('files=(data/*.txt); echo ${#files[@]} ${files[0]}', '2 data/a.txt\n')
t('declare -a empty; echo "n=${#empty[@]}"', 'n=0\n')
t('read -a parts <<< "one two three"; echo ${parts[2]}', 'three\n')
t('echo "${fruits[@]:1:2}"', 'banana cherry\n')
// arithmetic
t('i=1; ((i++)); ((i += 5)); echo $i', '7\n')
t('for ((k=0; k<3; k++)); do echo -n "$k "; done; echo', '0 1 2 \n')
t('n=5; if (( n > 3 )); then echo big; fi', 'big\n')
t('echo $(( 7 % 3 )) $(( 2 ** 10 )) $(( 1 ? 10 : 20 ))', '1 1024 10\n')
// parameter expansion
t('name=backup-2026-09-17.tar.gz; echo ${name%.tar.gz} ${name##*-} ${name/2026/YYYY}', 'backup-2026-09-17 17.tar.gz backup-YYYY-09-17.tar.gz\n')
t('s=hello; echo ${s^^} ${s:1:3} ${s^}', 'HELLO ell Hello\n')
t('x="a b"; y=$x; z=${x^^}; echo "$y|$z"', 'a b|A B\n')
// here-docs
t('cat <<EOF\nhi $USER\nline two\nEOF', 'hi learner\nline two\n')
t("cat <<'EOF'\nno $USER expansion\nEOF", 'no $USER expansion\n')
t('cat > note.txt <<EOF\nfirst\nsecond\nEOF\nwc -l note.txt', '2 note.txt\n')
t('cat <<-EOF\n\tindented\n\tEOF', 'indented\n')
t('grep two <<EOF\none\ntwo\nEOF', 'two\n')
t('wc -w <<< "a b c"', '3\n')
// getopts
script('opts.sh', '#!/bin/bash\nverbose=0\nout=""\nwhile getopts "vo:h" opt; do\n  case $opt in\n    v) verbose=1 ;;\n    o) out=$OPTARG ;;\n    h) echo "usage: opts.sh [-v] [-o FILE] args"; exit 0 ;;\n    *) echo "bad option" >&2; exit 1 ;;\n  esac\ndone\nshift $((OPTIND - 1))\necho "verbose=$verbose out=$out rest=$*"\n')
t('./opts.sh -v -o result.txt one two', 'verbose=1 out=result.txt rest=one two\n')
t('./opts.sh -h', 'usage: opts.sh [-v] [-o FILE] args\n')
t('./opts.sh -x; echo $?', /illegal option -- x\nbad option\n1\n$/)
t('./opts.sh -vo out.log x', 'verbose=1 out=out.log rest=x\n')
// set -e, -u, pipefail
script('strict.sh', '#!/bin/bash\nset -euo pipefail\necho start\nfalse\necho never\n')
t('./strict.sh; echo rc=$?', 'start\nrc=1\n')
script('unset.sh', '#!/bin/bash\nset -u\necho "$MISSING_VAR"\necho never\n')
t('./unset.sh; echo rc=$?', /MISSING_VAR: unbound variable\nrc=1\n$/)
script('pf.sh', '#!/bin/bash\nset -o pipefail\nfalse | true\necho rc=$?\n')
t('./pf.sh', 'rc=1\n')
script('cond.sh', '#!/bin/bash\nset -e\nif false; then echo no; fi\nfalse || echo recovered\n! false\necho end\n')
t('./cond.sh', 'recovered\nend\n')
t('echo after; echo $?', 'after\n0\n')
script('andlist.sh', '#!/bin/bash\nset -e\nname=""\n[ -n "$name" ] && echo "has name"\necho "still here $0"\n')
t('./andlist.sh', 'still here ./andlist.sh\n')
// trap
script('trap.sh', '#!/bin/bash\ntmp=$(mktemp -d)\ntrap \'rm -rf "$tmp"; echo cleaned\' EXIT\necho "$tmp" > tmpname\necho working\nexit 3\n')
t('./trap.sh; echo rc=$?', 'working\ncleaned\nrc=3\n')
t('test -d "$(cat tmpname)" && echo still || echo gone', 'gone\n')
t('f=$(mktemp); echo "$f" | grep -c "^/tmp/tmp\\."', '1\n')
t('mktemp -d /tmp/build.XXXXXX | grep -c "^/tmp/build\\."', '1\n')
// local scoping
script('local.sh', '#!/bin/bash\nx=outer\nf() {\n  local x=inner\n  echo "in $x"\n}\nf\necho "out $x"\n')
t('./local.sh', 'in inner\nout outer\n')
// shellcheck
script('bad.sh', 'src=$1\ncp $src /tmp\ncd /tmp\necho `date`\n')
t('shellcheck bad.sh', /SC2148[\s\S]*SC2086[\s\S]*SC2164[\s\S]*SC2006/)
t('shellcheck bad.sh > /dev/null 2>&1; echo $?', /1\n$/)
script('good.sh', '#!/bin/bash\nset -euo pipefail\nsrc="$1"\ncp "$src" /tmp\necho "$(date)"\n')
t('shellcheck good.sh; echo rc=$?', 'rc=0\n')
// tar
t('tar -czf data.tar.gz data && tar -tzf data.tar.gz', 'data/\ndata/a.txt\ndata/b.txt\n')
t('mkdir restore && tar -xzf data.tar.gz -C restore && cat restore/data/b.txt', 'beta\n')
t('tar czf second.tar.gz data && ls -t *.tar.gz | head -1', 'second.tar.gz\n')
t('ls -t *.tar.gz | tail -n +2', 'data.tar.gz\n')
t('printf "%s\\n" one two three | head -n -1', 'one\ntwo\n')
t('printf "%-6s|%05d|%.2f\\n" ab 42 3.14159', 'ab    |00042|3.14\n')
t('printf -v greeting "hi %s" bob; echo "$greeting"', 'hi bob\n')
// set -x
script('x.sh', '#!/bin/bash\nset -x\necho hi\n')
t('./x.sh', '+ echo hi\nhi\n')
t('bash -x x.sh 2>&1 | head -1', /^\+ /)
// [[ && ]]
t('if [[ -d data && -f data/a.txt ]]; then echo both; fi', 'both\n')
t('[[ "abc" == a* ]] && echo glob', 'glob\n')
// incomplete detection
for (const partial of ['case $x in', 'cat <<EOF\nline', 'arr=(a b']) {
  try { sh.run(partial); fails++; console.log('FAIL expected Incomplete for', JSON.stringify(partial)) }
  catch (e) { if ((e as Error).constructor.name !== 'Incomplete') { fails++; console.log('FAIL wrong throw', partial, e) } }
}
console.log(fails ? `${fails} BASH2 FAILURES` : 'ALL BASH2 SMOKE TESTS PASSED')
process.exit(fails ? 1 : 0)
