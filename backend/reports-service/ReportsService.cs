using System.Text;
using System.Text.Json;
using ClickHouse.Client.ADO;
using ClickHouse.Client.Utility;
using Minio;
using Minio.DataModel.Args;

public class ReportsService
{
    private readonly string _bucketName;
    private readonly string _clickHouseConnection;
    private readonly string _cdnHost;
    private readonly IMinioClient minioClient;

    public ReportsService(IConfiguration configuration, IMinioClient minioClient)
    {
        _bucketName = configuration["MINIO_BUCKET_NAME"];
        _clickHouseConnection = configuration["CLICKHOUSE_CONNECTION"];
        _cdnHost = configuration["CDN_HOST"];
        this.minioClient = minioClient;
    }

    public async Task<int?> GetUserIdByEmailAsync(string email)
    {
        using var connection = new ClickHouseConnection(_clickHouseConnection);
        await connection.OpenAsync();

        using var command = new ClickHouseCommand(connection);
        command.CommandText = """
            SELECT user_id
            FROM customers
            WHERE email = {email:Int32}
            """;
        command.AddParameter(parameterName: "email", "String", email);

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return reader.GetInt32(0); // или reader.GetInt32(0)
        }
        else
        {
            return null; // пользователь не найден
        }
    }

    public async Task<IResult> GetReportFile(int userId)
    {
        // Основной источник — витрина, которую заполняет DAG
        var report = await GetReportFromAsync(userId);
        var json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });
        var bytes = Encoding.UTF8.GetBytes(json);

        return TypedResults.File(
            fileContents: bytes,
            contentType: "application/json",
            fileDownloadName: "person.json"
        );
    }

    public async Task<bool> GenerateAndSaveReportAsync(int userId)
    {
        var result = await GetReportFromAsync(userId);
        var hasData = result.Any();
        if (hasData)
        {
            await SaveInMinioAsync(result, GenerateFileName(userId));
            return true;
        }
        else
        {
            return false;
        }
    }

    public async Task<Dictionary<string, object?>> GetReportFromAsync(int userId)
    {
        var result = new Dictionary<string, object?>();
        result.Add("report-date-generated", DateTimeOffset.UtcNow);

        using var connection = new ClickHouseConnection(_clickHouseConnection);
        await connection.OpenAsync();

        using var command = new ClickHouseCommand(connection);
        command.CommandText = "SELECT * FROM default.report_patient_activity_mart WHERE user_id = {userId:Int32}";
        command.AddParameter("userId", "Int32", userId);

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            // Считываем все столбцы в словарь
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var columnName = reader.GetName(i);
                var value = reader.GetValue(i);

                // DBNull заменяем на null
                result.Add(columnName, value == DBNull.Value ? null : value);
            }
            result["has_data"] = true;
            return result;
        }

        // Нет данных в представлении — вернём базовый каркас, чтобы фронт не показывал {}
        return new Dictionary<string, object?>
        {
            ["has_data"] = false,
            ["user_id"] = userId,
            ["message"] = "Данные отчёта пока отсутствуют"
        };
    }

    // Получаем данные из материализованного представления из задания 5
    public async Task<Dictionary<string, object?>> GetReportFromMvAsync(int userId)
    {
        var result = new Dictionary<string, object?>();
        result.Add("report-date-generated", DateTimeOffset.UtcNow);

        using var connection = new ClickHouseConnection(_clickHouseConnection);
        await connection.OpenAsync();

        using var command = new ClickHouseCommand(connection);
        command.CommandText = "SELECT * FROM default.emg_user_summary_mv WHERE user_id = {userId:Int32}";
        command.AddParameter("userId", "Int32", userId);

        using var reader = await command.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            // Считываем все столбцы в словарь
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var columnName = reader.GetName(i);
                var value = reader.GetValue(i);

                // DBNull заменяем на null
                result.Add(columnName, value == DBNull.Value ? null : value);
            }

            return result;
        }

        return [];
    }


    public async Task<bool> IsGeneratedReportExistsAsync(int userId)
    {
        try
        {
            var objInfo = await minioClient.StatObjectAsync(
                new StatObjectArgs()
                    .WithBucket(_bucketName)
                    .WithObject(GenerateFileName(userId))
            );

            return true; // Если не выбросило исключение, значит файл существует
        }
        catch (Exception)
        {
            return false; // считаем, что файла нет или ошибка доступа
        }
    }
    public async Task<string> SaveInMinioAsync(object report, string fileName)
    {
        var json = JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true });
        var bytes = Encoding.UTF8.GetBytes(json);

        var bucketExists = await minioClient.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucketName));
        if (!bucketExists)
        {
            await minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName));
            Console.WriteLine($"Бакет '{_bucketName}' создан.");
        }

        var stream = new MemoryStream(bytes);

        await minioClient.PutObjectAsync(
            new PutObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(fileName)
        .WithStreamData(stream)
                .WithObjectSize(stream.Length)
                .WithContentType("application/json")
        );

        Console.WriteLine($"Файл '{fileName}' успешно загружен в бакет '{_bucketName}'.");
        return $"{_bucketName}/{fileName}"; // Пусть по которому он сохранён
    }

    public static string GenerateFileName(int userId) => $"report_{userId}.json";
    public string GenerateCdnReportLink(int userId) => $"http://{_cdnHost}/{_bucketName}/{GenerateFileName(userId)}";
}