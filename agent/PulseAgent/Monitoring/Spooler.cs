using System.IO;
using System.Text.Json;
using PulseAgent.Sync;

namespace PulseAgent.Monitoring;

// Durable, crash-safe buffer of finalized buckets. Backed by a JSONL file so
// data survives restarts (essential for timed-sync mode that buffers all day).
public sealed class Spooler
{
    private const int MaxBuckets = 20_160; // ~14 days of per-minute buckets
    private readonly string _path = Path.Combine(Paths.DataDir, "spool.jsonl");
    private readonly object _gate = new();
    private readonly List<BucketDto> _buckets = new();

    public Spooler() => LoadFromDisk();

    public int Count { get { lock (_gate) return _buckets.Count; } }

    public void Enqueue(BucketDto bucket)
    {
        lock (_gate)
        {
            _buckets.Add(bucket);
            if (_buckets.Count > MaxBuckets)
                _buckets.RemoveRange(0, _buckets.Count - MaxBuckets);
            try
            {
                Directory.CreateDirectory(Paths.DataDir);
                File.AppendAllText(_path, JsonSerializer.Serialize(bucket, Json.Options) + "\n");
            }
            catch (Exception ex) { Log.Error("Spool append failed", ex); }
        }
    }

    // Snapshot everything currently buffered (for a sync attempt).
    public List<BucketDto> Snapshot()
    {
        lock (_gate) return new List<BucketDto>(_buckets);
    }

    // Remove buckets that were successfully delivered (matched by timestamp).
    public void CommitDelivered(IEnumerable<BucketDto> delivered)
    {
        var tsSet = delivered.Select(b => b.Ts).ToHashSet();
        lock (_gate)
        {
            _buckets.RemoveAll(b => tsSet.Contains(b.Ts));
            Rewrite();
        }
    }

    private void Rewrite()
    {
        try
        {
            Directory.CreateDirectory(Paths.DataDir);
            var tmp = _path + ".tmp";
            using (var w = new StreamWriter(tmp, false))
                foreach (var b in _buckets)
                    w.WriteLine(JsonSerializer.Serialize(b, Json.Options));
            File.Move(tmp, _path, overwrite: true);
        }
        catch (Exception ex) { Log.Error("Spool rewrite failed", ex); }
    }

    private void LoadFromDisk()
    {
        try
        {
            if (!File.Exists(_path)) return;
            foreach (var line in File.ReadAllLines(_path))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                var b = JsonSerializer.Deserialize<BucketDto>(line, Json.Options);
                if (b != null) _buckets.Add(b);
            }
            Log.Info($"Loaded {_buckets.Count} buffered buckets from spool.");
        }
        catch (Exception ex) { Log.Error("Spool load failed", ex); }
    }
}
